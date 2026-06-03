// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

// ─────────────────────────────────────────────────────────────────
// Somnia Agents – Platform types
// ─────────────────────────────────────────────────────────────────

enum ResponseStatus {
    None,
    Pending,
    Success,
    Failed,
    TimedOut
}

struct Response {
    address validator;
    bytes result;
    ResponseStatus status;
    uint256 receipt;
    uint256 timestamp;
    uint256 executionCost;
}

struct Request {
    uint256 id;
    address requester;
    address callbackAddress;
    bytes4 callbackSelector;
    address[] subcommittee;
    Response[] responses;
    uint256 responseCount;
    uint256 failureCount;
    uint256 threshold;
    uint256 createdAt;
    uint256 deadline;
    ResponseStatus status;
}

interface IAgentRequester {
    function createRequest(
        uint256 agentId,
        address callbackAddress,
        bytes4 callbackSelector,
        bytes calldata payload
    ) external payable returns (uint256 requestId);

    function createAdvancedRequest(
        uint256 agentId,
        address callbackAddress,
        bytes4 callbackSelector,
        bytes calldata payload,
        uint256 subcommitteeSize,
        uint256 threshold,
        uint8 consensusType,
        uint256 timeout
    ) external payable returns (uint256 requestId);
}

interface ILLMInferenceAgent {
    function inferString(
        string calldata prompt,
        string calldata system,
        bool chainOfThought,
        string[] calldata allowedValues
    ) external returns (string memory response);

    function inferChat(
        string[] calldata roles,
        string[] calldata messages,
        bool chainOfThought
    ) external returns (string memory response);

    struct OnchainTool {
        string signature;
        string description;
    }

    function inferToolsChat(
        string[] calldata roles,
        string[] calldata messages,
        string[] calldata mcpServerUrls,
        OnchainTool[] calldata onchainTools,
        uint256 maxIterations,
        bool chainOfThought
    ) external returns (
        string memory finishReason,
        string memory response,
        string[] memory updatedRoles,
        string[] memory updatedMessages,
        string[] memory pendingToolCallIds,
        bytes[] memory pendingToolCalls
    );
}

// ─────────────────────────────────────────────────────────────────
// GhostMind V2 — inferToolsChat + MCP Privacy
//
// FLOW:
//   1. createGame() → LLM calls ghostmind MCP tool (init) → "ready"
//   2. askQuestion() → LLM calls ghostmind MCP tool (question) → "yes"/"no"
//   3. finalGuess() → LLM calls ghostmind MCP tool (guess) → "correct"/"incorrect"
//
// Character is stored privately in MCP server, never exposed in receipts.
// MCP server uses external LLM (Claude/GPT) for accurate answers.
// ─────────────────────────────────────────────────────────────────

contract GhostMindV2 {

    // ── Constants ─────────────────────────────────────────────────

    IAgentRequester public constant PLATFORM =
        IAgentRequester(0x037Bb9C718F3f7fe5eCBDB0b600D607b52706776); // Testnet

    uint256 public constant LLM_AGENT_ID = 12847293847561029384;
    uint256 public constant LLM_DEPOSIT = 0.24 ether;
    uint256 public constant PROTOCOL_FEE_BPS = 300; // 3%

    address public immutable feeRecipient;
    string public mcpServerUrl; // MCP server URL (set by owner)

    // ── System Prompt ─────────────────────────────────────────────
    // Explicit prompt - MUST use the MCP tool for every action

    string private constant SYSTEM_PROMPT =
        "You are playing GhostMind. "
        "IMPORTANT: You MUST call the ghostmind tool for EVERY question and guess. "
        "NEVER answer from memory or context - ALWAYS use the tool. "
        "The tool has the secret character - you do not know it. "
        "After the tool responds, reply with exactly what it says.";

    // ── Game State ────────────────────────────────────────────────

    enum Difficulty {
        Easy,   // Very famous people everyone knows
        Medium, // Moderately famous, known in their field
        Hard    // Obscure or lesser-known figures
    }

    enum GamePhase {
        NonExistent,   // 0
        Initializing,  // 1 - waiting for LLM init
        Active,        // 2 - open for questions/guesses
        Processing,    // 3 - waiting for LLM response
        Finished       // 4 - winner found
    }

    enum RequestType {
        Init,
        Question,
        Guess
    }

    struct QA {
        string question;
        string answer;
    }

    struct Game {
        address gameMaster;
        GamePhase phase;
        Difficulty difficulty;
        uint256 gameFee;
        uint256 pot;
        uint256 questionCount;
        QA[] history;              // For frontend display
        string[] chatRoles;        // inferChat roles: "system", "user", "assistant"
        string[] chatMessages;     // inferChat messages (parallel to roles)
        string pendingQuestion;    // Current question/guess being processed
        address pendingPlayer;     // Who asked the pending question
        RequestType pendingType;   // Type of pending request
        uint256 pendingRequestId;
        address winner;
        string winningGuess;       // The guess that won
        uint256 createdAt;
    }

    mapping(uint256 => Game) public games;
    mapping(uint256 => uint256) public requestToGame;

    uint256 public gameCounter;

    // ── Player Stats (Leaderboard) ───────────────────────────────

    struct PlayerStats {
        uint256 questionsAsked;
        uint256 correctGuesses;
        uint256 incorrectGuesses;
    }

    mapping(address => PlayerStats) public playerStats;
    address[] public knownPlayers;
    mapping(address => bool) private isKnownPlayer;

    // ── Events ────────────────────────────────────────────────────

    event GameCreated(uint256 indexed gameId, address indexed gameMaster, uint256 pot, uint256 gameFee, Difficulty difficulty);
    event GameReady(uint256 indexed gameId);
    event QuestionAsked(uint256 indexed gameId, address indexed player, string question, uint256 newPot);
    event QuestionAnswered(uint256 indexed gameId, string question, string answer, uint256 questionCount);
    event GuessAttempted(uint256 indexed gameId, address indexed player, string guess, uint256 newPot);
    event GuessResult(uint256 indexed gameId, address indexed player, string guess, bool correct);
    event GameWon(uint256 indexed gameId, address indexed winner, string guess, uint256 prize);
    event GameEnded(uint256 indexed gameId, address indexed recipient, uint256 amount, string reason);
    event RequestFailed(uint256 indexed gameId, uint256 requestId, ResponseStatus status);

    // ── Errors ────────────────────────────────────────────────────

    error InsufficientPayment(uint256 required, uint256 sent);
    error GameNotActive(uint256 gameId);
    error GameNotProcessing(uint256 gameId);
    error GameNotOver(uint256 gameId);
    error TransferFailed();
    error OnlyPlatform();

    // ── Constructor ───────────────────────────────────────────────

    address public owner;

    constructor(address _feeRecipient, string memory _mcpServerUrl) {
        feeRecipient = _feeRecipient;
        mcpServerUrl = _mcpServerUrl;
        owner = msg.sender;
    }

    function setMcpServerUrl(string memory _url) external {
        require(msg.sender == owner, "Only owner");
        mcpServerUrl = _url;
    }

    // ─────────────────────────────────────────────────────────────
    // 1. CREATE GAME
    // ─────────────────────────────────────────────────────────────

    function createGame(uint256 gameFee, Difficulty difficulty) external payable returns (uint256 gameId) {
        require(msg.value >= LLM_DEPOSIT, "Must cover LLM init deposit");

        gameId = ++gameCounter;
        Game storage g = games[gameId];

        g.gameMaster = msg.sender;
        g.phase = GamePhase.Initializing;
        g.difficulty = difficulty;
        g.gameFee = gameFee;
        g.pot = msg.value - LLM_DEPOSIT;
        g.createdAt = block.timestamp;

        // Initialize chat with system prompt + init message
        g.chatRoles.push("system");
        g.chatMessages.push(SYSTEM_PROMPT);

        string memory diffStr = _difficultyToString(difficulty);
        string memory initMessage = string(abi.encodePacked(
            "Use ghostmind tool. action: init, gameId: ",
            _uint2str(gameId),
            ", difficulty: ",
            diffStr
        ));
        g.chatRoles.push("user");
        g.chatMessages.push(initMessage);

        // Build inferToolsChat payload with MCP
        string[] memory mcpUrls = new string[](1);
        mcpUrls[0] = mcpServerUrl;
        ILLMInferenceAgent.OnchainTool[] memory emptyTools = new ILLMInferenceAgent.OnchainTool[](0);

        bytes memory payload = abi.encodeWithSelector(
            ILLMInferenceAgent.inferToolsChat.selector,
            g.chatRoles,
            g.chatMessages,
            mcpUrls,
            emptyTools,
            5,      // maxIterations
            false   // chainOfThought
        );

        uint256 requestId = PLATFORM.createAdvancedRequest{value: LLM_DEPOSIT}(
            LLM_AGENT_ID,
            address(this),
            this.handleInitResponse.selector,
            payload,
            1,    // subcommitteeSize
            1,    // threshold
            0,    // consensusType (Majority)
            300   // timeout (5 min)
        );

        g.pendingRequestId = requestId;
        g.pendingType = RequestType.Init;
        requestToGame[requestId] = gameId;

        emit GameCreated(gameId, msg.sender, g.pot, gameFee, difficulty);
    }

    function handleInitResponse(
        uint256 requestId,
        Response[] memory responses,
        ResponseStatus status,
        Request memory
    ) external {
        if (msg.sender != address(PLATFORM)) revert OnlyPlatform();

        uint256 gameId = requestToGame[requestId];
        Game storage g = games[gameId];

        if (status != ResponseStatus.Success || responses.length == 0) {
            _failGame(g, gameId, requestId, status);
            return;
        }

        // Store only "ready" on-chain — character stays implicit (Somnia receipt may still show raw LLM text)
        g.chatRoles.push("assistant");
        g.chatMessages.push("ready");

        g.phase = GamePhase.Active;
        emit GameReady(gameId);
    }

    // ─────────────────────────────────────────────────────────────
    // 2. ASK QUESTION
    // ─────────────────────────────────────────────────────────────

    function askQuestion(uint256 gameId, string calldata question) external payable {
        Game storage g = games[gameId];

        if (g.phase != GamePhase.Active) revert GameNotActive(gameId);

        uint256 required = LLM_DEPOSIT + g.gameFee;
        if (msg.value < required) revert InsufficientPayment(required, msg.value);

        g.pot += g.gameFee;
        _refundExcess(msg.sender, msg.value - required);

        g.phase = GamePhase.Processing;
        g.pendingQuestion = question;
        g.pendingPlayer = msg.sender;
        g.pendingType = RequestType.Question;

        // Build FRESH context - don't send history so LLM must use tool
        string[] memory freshRoles = new string[](2);
        string[] memory freshMessages = new string[](2);

        freshRoles[0] = "system";
        freshMessages[0] = SYSTEM_PROMPT;

        freshRoles[1] = "user";
        freshMessages[1] = string(abi.encodePacked(
            "Use ghostmind tool. gameId: ", _uint2str(gameId), ", question: \"", question, "\""
        ));

        // Build inferToolsChat payload with MCP
        string[] memory mcpUrls = new string[](1);
        mcpUrls[0] = mcpServerUrl;
        ILLMInferenceAgent.OnchainTool[] memory emptyTools = new ILLMInferenceAgent.OnchainTool[](0);

        bytes memory payload = abi.encodeWithSelector(
            ILLMInferenceAgent.inferToolsChat.selector,
            freshRoles,
            freshMessages,
            mcpUrls,
            emptyTools,
            5,      // maxIterations
            false   // chainOfThought
        );

        uint256 requestId = PLATFORM.createAdvancedRequest{value: LLM_DEPOSIT}(
            LLM_AGENT_ID,
            address(this),
            this.handleQuestionResponse.selector,
            payload,
            1,    // subcommitteeSize
            1,    // threshold
            0,    // consensusType (Majority)
            300   // timeout (5 min)
        );

        g.pendingRequestId = requestId;
        requestToGame[requestId] = gameId;

        emit QuestionAsked(gameId, msg.sender, question, g.pot);
    }

    function handleQuestionResponse(
        uint256 requestId,
        Response[] memory responses,
        ResponseStatus status,
        Request memory
    ) external {
        if (msg.sender != address(PLATFORM)) revert OnlyPlatform();

        uint256 gameId = requestToGame[requestId];
        Game storage g = games[gameId];

        if (status != ResponseStatus.Success || responses.length == 0) {
            // Refund and reset - also remove the pending question from chat
            g.chatRoles.pop();
            g.chatMessages.pop();
            _refundQuestionFee(g, gameId, requestId, status);
            return;
        }

        // inferToolsChat returns (finishReason, response, updatedRoles, updatedMessages, ...)
        // We need the second element (response), not the first (finishReason = "stop")
        (
            ,                           // finishReason (skip)
            string memory rawAnswer,    // response (what we want)
            ,                           // updatedRoles (skip)
            ,                           // updatedMessages (skip)
            ,                           // pendingToolCallIds (skip)
                                        // pendingToolCalls (skip)
        ) = abi.decode(responses[0].result, (string, string, string[], string[], string[], bytes[]));
        string memory answer = _coerceYesNo(rawAnswer);

        // Chat replay uses only yes/no so long LLM replies do not poison later turns
        g.chatRoles.push("assistant");
        g.chatMessages.push(answer);

        // Store in QA history for frontend display
        g.history.push(QA({
            question: g.pendingQuestion,
            answer: answer
        }));
        g.questionCount++;

        emit QuestionAnswered(gameId, g.pendingQuestion, answer, g.questionCount);

        // Record stats for leaderboard
        _recordQuestion(g.pendingPlayer);

        g.phase = GamePhase.Active;

        // Clear pending
        g.pendingQuestion = "";
        g.pendingPlayer = address(0);
    }

    // ─────────────────────────────────────────────────────────────
    // 3. FINAL GUESS
    // ─────────────────────────────────────────────────────────────

    function finalGuess(uint256 gameId, string calldata guess) external payable {
        Game storage g = games[gameId];

        if (g.phase != GamePhase.Active) revert GameNotActive(gameId);

        // Always require LLM_DEPOSIT + gameFee - gameFee refunded if correct
        uint256 required = LLM_DEPOSIT + g.gameFee;
        if (msg.value < required) revert InsufficientPayment(required, msg.value);

        // Don't add gameFee to pot yet - wait for result
        _refundExcess(msg.sender, msg.value - required);

        g.phase = GamePhase.Processing;
        g.pendingQuestion = guess;
        g.pendingPlayer = msg.sender;
        g.pendingType = RequestType.Guess;

        // Build FRESH context - don't send history so LLM must use tool
        string[] memory freshRoles = new string[](2);
        string[] memory freshMessages = new string[](2);

        freshRoles[0] = "system";
        freshMessages[0] = SYSTEM_PROMPT;

        freshRoles[1] = "user";
        freshMessages[1] = string(abi.encodePacked(
            "Use ghostmind tool. gameId: ", _uint2str(gameId), ", guess: \"", guess, "\""
        ));

        // Build inferToolsChat payload with MCP
        string[] memory mcpUrls = new string[](1);
        mcpUrls[0] = mcpServerUrl;
        ILLMInferenceAgent.OnchainTool[] memory emptyTools = new ILLMInferenceAgent.OnchainTool[](0);

        bytes memory payload = abi.encodeWithSelector(
            ILLMInferenceAgent.inferToolsChat.selector,
            freshRoles,
            freshMessages,
            mcpUrls,
            emptyTools,
            5,      // maxIterations
            false   // chainOfThought
        );

        uint256 requestId = PLATFORM.createAdvancedRequest{value: LLM_DEPOSIT}(
            LLM_AGENT_ID,
            address(this),
            this.handleGuessResponse.selector,
            payload,
            1,    // subcommitteeSize
            1,    // threshold
            0,    // consensusType (Majority)
            300   // timeout (5 min)
        );

        g.pendingRequestId = requestId;
        requestToGame[requestId] = gameId;

        emit GuessAttempted(gameId, msg.sender, guess, g.pot);
    }

    function handleGuessResponse(
        uint256 requestId,
        Response[] memory responses,
        ResponseStatus status,
        Request memory
    ) external {
        if (msg.sender != address(PLATFORM)) revert OnlyPlatform();

        uint256 gameId = requestToGame[requestId];
        Game storage g = games[gameId];

        if (status != ResponseStatus.Success || responses.length == 0) {
            // Refund gameFee and reset - also remove the pending guess from chat
            g.chatRoles.pop();
            g.chatMessages.pop();
            (bool ok, ) = g.pendingPlayer.call{value: g.gameFee}("");
            if (!ok) {} // Log but don't block
            g.phase = GamePhase.Active;
            emit RequestFailed(gameId, requestId, status);
            return;
        }

        // inferToolsChat returns (finishReason, response, updatedRoles, updatedMessages, ...)
        // We need the second element (response), not the first (finishReason = "stop")
        (
            ,                           // finishReason (skip)
            string memory rawResult,    // response (what we want)
            ,                           // updatedRoles (skip)
            ,                           // updatedMessages (skip)
            ,                           // pendingToolCallIds (skip)
                                        // pendingToolCalls (skip)
        ) = abi.decode(responses[0].result, (string, string, string[], string[], string[], bytes[]));
        string memory result = _coerceGuessResult(rawResult);

        g.chatRoles.push("assistant");
        g.chatMessages.push(result);

        bool isCorrect = _startsWith(result, "correct");

        emit GuessResult(gameId, g.pendingPlayer, g.pendingQuestion, isCorrect);

        if (isCorrect) {
            // Record correct guess for leaderboard
            _recordCorrectGuess(g.pendingPlayer);

            // WINNER! Refund the gameFee they sent
            (bool refundOk, ) = g.pendingPlayer.call{value: g.gameFee}("");
            if (!refundOk) {} // Continue anyway

            g.winningGuess = g.pendingQuestion;
            _endGameWinner(g, gameId, g.pendingPlayer);
        } else {
            // Record incorrect guess for leaderboard
            _recordIncorrectGuess(g.pendingPlayer);

            // Incorrect - add gameFee to pot
            g.pot += g.gameFee;

            // Store in QA history for frontend display
            g.history.push(QA({
                question: string(abi.encodePacked("GUESS: ", g.pendingQuestion)),
                answer: "incorrect"
            }));

            g.phase = GamePhase.Active;
        }

        // Clear pending
        g.pendingQuestion = "";
        g.pendingPlayer = address(0);
    }

    // ─────────────────────────────────────────────────────────────
    // Internal - Game End
    // ─────────────────────────────────────────────────────────────

    function _endGameWinner(Game storage g, uint256 gameId, address winner) internal {
        g.phase = GamePhase.Finished;
        g.winner = winner;

        uint256 pot = g.pot;
        g.pot = 0;

        uint256 fee = (pot * PROTOCOL_FEE_BPS) / 10_000;
        uint256 prize = pot - fee;

        if (fee > 0) {
            (bool fok, ) = feeRecipient.call{value: fee}("");
            if (!fok) prize = pot;
        }

        (bool ok, ) = winner.call{value: prize}("");
        if (!ok) revert TransferFailed();

        emit GameWon(gameId, winner, g.winningGuess, prize);
    }

    function _endGameNoWinner(Game storage g, uint256 gameId, string memory reason) internal {
        g.phase = GamePhase.Finished;
        uint256 pot = g.pot;
        g.pot = 0;

        if (pot > 0) {
            (bool ok, ) = g.gameMaster.call{value: pot}("");
            if (!ok) revert TransferFailed();
        }

        emit GameEnded(gameId, g.gameMaster, pot, reason);
    }

    function _failGame(Game storage g, uint256 gameId, uint256 requestId, ResponseStatus status) internal {
        g.phase = GamePhase.Finished;
        emit RequestFailed(gameId, requestId, status);

        uint256 refund = g.pot;
        g.pot = 0;

        if (refund > 0) {
            (bool ok, ) = g.gameMaster.call{value: refund}("");
            if (!ok) revert TransferFailed();
        }
    }

    function _refundQuestionFee(Game storage g, uint256 gameId, uint256 requestId, ResponseStatus status) internal {
        g.phase = GamePhase.Active;
        emit RequestFailed(gameId, requestId, status);

        // Refund gameFee to asker
        g.pot -= g.gameFee;
        (bool ok, ) = g.pendingPlayer.call{value: g.gameFee}("");
        if (!ok) {} // Log but don't block

        g.pendingQuestion = "";
        g.pendingPlayer = address(0);
    }

    function _refundExcess(address to, uint256 amount) internal {
        if (amount > 0) {
            (bool ok, ) = to.call{value: amount}("");
            if (!ok) revert TransferFailed();
        }
    }

    // ─────────────────────────────────────────────────────────────
    // Recovery
    // ─────────────────────────────────────────────────────────────

    function resetStuckGame(uint256 gameId) external {
        Game storage g = games[gameId];
        require(g.phase == GamePhase.Processing, "Not stuck");
        require(block.timestamp > g.createdAt + 30 minutes, "Too early");

        g.phase = GamePhase.Active;

        // Refund pending player if there is one
        if (g.pendingPlayer != address(0) && g.pendingType != RequestType.Init) {
            (bool ok, ) = g.pendingPlayer.call{value: g.gameFee}("");
            if (!ok) {} // Log in prod
            if (g.pendingType == RequestType.Question) {
                g.pot -= g.gameFee;
            }
        }

        g.pendingQuestion = "";
        g.pendingPlayer = address(0);
    }

    // ─────────────────────────────────────────────────────────────
    // View Functions
    // ─────────────────────────────────────────────────────────────

    function getGame(uint256 gameId) external view returns (
        address gameMaster,
        GamePhase phase,
        Difficulty difficulty,
        uint256 gameFee,
        uint256 pot,
        uint256 questionCount,
        address winner
    ) {
        Game storage g = games[gameId];
        return (g.gameMaster, g.phase, g.difficulty, g.gameFee, g.pot, g.questionCount, g.winner);
    }

    function getHistory(uint256 gameId) external view returns (QA[] memory) {
        return games[gameId].history;
    }

    function getChatHistory(uint256 gameId) external view returns (string[] memory roles, string[] memory messages) {
        Game storage g = games[gameId];
        return (g.chatRoles, g.chatMessages);
    }

    function getActionCost(uint256 gameId) external view returns (uint256 questionCost, uint256 guessCost) {
        Game storage g = games[gameId];
        questionCost = LLM_DEPOSIT + g.gameFee;
        guessCost = LLM_DEPOSIT + g.gameFee; // Now requires LLM call
    }

    // ── Leaderboard View Functions ───────────────────────────────

    function getPlayerStats(address player) external view returns (PlayerStats memory) {
        return playerStats[player];
    }

    function getKnownPlayersCount() external view returns (uint256) {
        return knownPlayers.length;
    }

    function getKnownPlayers(uint256 offset, uint256 limit) external view returns (address[] memory) {
        uint256 end = offset + limit;
        if (end > knownPlayers.length) end = knownPlayers.length;
        if (offset >= knownPlayers.length) return new address[](0);
        address[] memory result = new address[](end - offset);
        for (uint256 i = offset; i < end; i++) {
            result[i - offset] = knownPlayers[i];
        }
        return result;
    }

    // ─────────────────────────────────────────────────────────────
    // Internal - Player Stats
    // ─────────────────────────────────────────────────────────────

    function _recordPlayer(address player) internal {
        if (!isKnownPlayer[player]) {
            isKnownPlayer[player] = true;
            knownPlayers.push(player);
        }
    }

    function _recordQuestion(address player) internal {
        _recordPlayer(player);
        playerStats[player].questionsAsked++;
    }

    function _recordCorrectGuess(address player) internal {
        _recordPlayer(player);
        playerStats[player].correctGuesses++;
    }

    function _recordIncorrectGuess(address player) internal {
        _recordPlayer(player);
        playerStats[player].incorrectGuesses++;
    }

    // ─────────────────────────────────────────────────────────────
    // Utilities
    // ─────────────────────────────────────────────────────────────

    function _difficultyToString(Difficulty d) internal pure returns (string memory) {
        if (d == Difficulty.Easy) return "easy";
        if (d == Difficulty.Medium) return "medium";
        return "hard";
    }

    /// @dev Collapse LLM output to yes/no for on-chain chat replay and transcript.
    function _coerceYesNo(string memory raw) internal pure returns (string memory) {
        string memory s = _normalizeResponse(raw);
        if (_startsWith(s, "yes")) return "yes";
        if (_startsWith(s, "no")) return "no";
        uint256 lastYes = _lastWordIndex(s, "yes");
        uint256 lastNo = _lastWordIndex(s, "no");
        if (lastYes != type(uint256).max && lastNo == type(uint256).max) return "yes";
        if (lastNo != type(uint256).max && lastYes == type(uint256).max) return "no";
        if (lastYes != type(uint256).max && lastNo != type(uint256).max) {
            return lastYes > lastNo ? "yes" : "no";
        }
        return s;
    }

    function _coerceGuessResult(string memory raw) internal pure returns (string memory) {
        string memory s = _normalizeResponse(raw);
        if (_startsWith(s, "correct")) return "correct";
        if (_startsWith(s, "incorrect")) return "incorrect";
        uint256 lastCorrect = _lastWordIndex(s, "correct");
        uint256 lastIncorrect = _lastWordIndex(s, "incorrect");
        if (lastCorrect != type(uint256).max && lastIncorrect == type(uint256).max) return "correct";
        if (lastIncorrect != type(uint256).max && lastCorrect == type(uint256).max) return "incorrect";
        if (lastCorrect != type(uint256).max && lastIncorrect != type(uint256).max) {
            return lastCorrect > lastIncorrect ? "correct" : "incorrect";
        }
        return s;
    }

    /// @dev Last start index of `word` as a whole word, or type(uint256).max if absent.
    function _lastWordIndex(string memory s, string memory word) internal pure returns (uint256) {
        bytes memory b = bytes(s);
        bytes memory w = bytes(word);
        if (w.length == 0 || b.length < w.length) return type(uint256).max;
        uint256 last = type(uint256).max;
        for (uint256 i = 0; i + w.length <= b.length; i++) {
            bool isMatch = true;
            for (uint256 j = 0; j < w.length; j++) {
                bytes1 c = b[i + j];
                bytes1 p = w[j];
                if (c >= 0x41 && c <= 0x5A) c = bytes1(uint8(c) + 32);
                if (p >= 0x41 && p <= 0x5A) p = bytes1(uint8(p) + 32);
                if (c != p) {
                    isMatch = false;
                    break;
                }
            }
            if (!isMatch) continue;
            bool leftOk = i == 0 || !_isAlphaNum(b[i - 1]);
            bool rightOk = i + w.length == b.length || !_isAlphaNum(b[i + w.length]);
            if (leftOk && rightOk) last = i;
        }
        return last;
    }

    function _isAlphaNum(bytes1 c) internal pure returns (bool) {
        return (c >= 0x30 && c <= 0x39) || (c >= 0x41 && c <= 0x5A) || (c >= 0x61 && c <= 0x7A);
    }

    function _normalizeResponse(string memory str) internal pure returns (string memory) {
        bytes memory strBytes = bytes(str);
        uint256 start = 0;
        uint256 end = strBytes.length;

        // Trim leading whitespace
        while (start < end && (strBytes[start] == 0x20 || strBytes[start] == 0x09 || strBytes[start] == 0x0A || strBytes[start] == 0x0D)) {
            start++;
        }
        // Trim trailing whitespace
        while (end > start && (strBytes[end - 1] == 0x20 || strBytes[end - 1] == 0x09 || strBytes[end - 1] == 0x0A || strBytes[end - 1] == 0x0D)) {
            end--;
        }

        // Create new bytes with trimmed content, lowercase
        bytes memory result = new bytes(end - start);
        for (uint256 i = start; i < end; i++) {
            bytes1 char = strBytes[i];
            // Convert uppercase to lowercase
            if (char >= 0x41 && char <= 0x5A) {
                result[i - start] = bytes1(uint8(char) + 32);
            } else {
                result[i - start] = char;
            }
        }
        return string(result);
    }

    function _startsWith(string memory str, string memory prefix) internal pure returns (bool) {
        bytes memory strBytes = bytes(str);
        bytes memory prefixBytes = bytes(prefix);
        if (strBytes.length < prefixBytes.length) return false;
        for (uint256 i = 0; i < prefixBytes.length; i++) {
            // Case-insensitive comparison
            bytes1 a = strBytes[i];
            bytes1 b = prefixBytes[i];
            if (a >= 0x41 && a <= 0x5A) a = bytes1(uint8(a) + 32);
            if (b >= 0x41 && b <= 0x5A) b = bytes1(uint8(b) + 32);
            if (a != b) return false;
        }
        return true;
    }

    function _uint2str(uint256 n) internal pure returns (string memory) {
        if (n == 0) return "0";
        uint256 temp = n;
        uint256 digits;
        while (temp != 0) { digits++; temp /= 10; }
        bytes memory buf = new bytes(digits);
        while (n != 0) { digits--; buf[digits] = bytes1(uint8(48 + n % 10)); n /= 10; }
        return string(buf);
    }

    receive() external payable {}
}

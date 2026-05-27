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
}

// ─────────────────────────────────────────────────────────────────
// GhostMind V2 — History-Based Architecture
//
// KEY INSIGHT: The LLM doesn't need to reveal the character name.
// Instead, we pass the full Q&A history with each call, and the
// LLM stays consistent with its previous answers.
//
// FLOW:
//   1. createGame() → LLM picks a character silently, responds "ready"
//   2. askQuestion() → Pass history + question, LLM answers yes/no
//   3. finalGuess() → Pass history + guess, LLM answers correct/incorrect
//
// The character name is NEVER stored on-chain or revealed in prompts.
// The LLM is the source of truth for the character's identity.
// ─────────────────────────────────────────────────────────────────

contract GhostMindV2 {

    // ── Constants ─────────────────────────────────────────────────

    IAgentRequester public constant PLATFORM =
        IAgentRequester(0x037Bb9C718F3f7fe5eCBDB0b600D607b52706776); // Testnet

    uint256 public constant LLM_AGENT_ID = 12847293847561029384;
    uint256 public constant LLM_DEPOSIT = 0.24 ether;
    uint256 public constant PROTOCOL_FEE_BPS = 300; // 3%

    address public immutable feeRecipient;

    // ── System Prompt ─────────────────────────────────────────────
    // Embedded in chat history as first message with role "system"

    string private constant SYSTEM_PROMPT =
        "You are the game master of a Guess Who guessing game. "
        "CRITICAL RULES: "
        "1. At game start, you pick ONE famous real person and remember them for the ENTIRE conversation. "
        "2. You must be 100% consistent with this character across ALL responses. "
        "3. For YES/NO questions: Answer with EXACTLY 'yes' or 'no' (lowercase, no punctuation, no extra text). "
        "4. For GUESSES: Answer with EXACTLY 'correct' or 'incorrect' (lowercase, no punctuation, no extra text). "
        "5. Be historically accurate with your answers. "
        "6. Accept reasonable name variations for guesses (partial names, different spellings). "
        "YOUR RESPONSE MUST BE EXACTLY ONE WORD: 'yes', 'no', 'correct', 'incorrect', or 'ready'. "
        "DO NOT add any explanation, punctuation, or additional text.";

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

    constructor(address _feeRecipient) {
        feeRecipient = _feeRecipient;
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

        string memory initMessage = string(abi.encodePacked(
            _getDifficultyHint(difficulty),
            "Pick your secret character now. Remember who you picked. ",
            "Confirm by responding with exactly: ready"
        ));
        g.chatRoles.push("user");
        g.chatMessages.push(initMessage);

        // Build inferChat payload
        bytes memory payload = abi.encodeWithSelector(
            ILLMInferenceAgent.inferChat.selector,
            g.chatRoles,
            g.chatMessages,
            false  // chainOfThought: false to hide character
        );

        uint256 requestId = PLATFORM.createRequest{value: LLM_DEPOSIT}(
            LLM_AGENT_ID,
            address(this),
            this.handleInitResponse.selector,
            payload
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

        // Save assistant response to chat history (should be "ready")
        string memory response = abi.decode(responses[0].result, (string));
        g.chatRoles.push("assistant");
        g.chatMessages.push(response);

        // LLM responded "ready" - game is now active
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

        // Add question to chat history
        string memory questionPrompt = string(abi.encodePacked(
            question,
            " Answer with exactly 'yes' or 'no'."
        ));
        g.chatRoles.push("user");
        g.chatMessages.push(questionPrompt);

        // Build inferChat payload with full history
        bytes memory payload = abi.encodeWithSelector(
            ILLMInferenceAgent.inferChat.selector,
            g.chatRoles,
            g.chatMessages,
            false  // chainOfThought: false
        );

        uint256 requestId = PLATFORM.createRequest{value: LLM_DEPOSIT}(
            LLM_AGENT_ID,
            address(this),
            this.handleQuestionResponse.selector,
            payload
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

        string memory rawAnswer = abi.decode(responses[0].result, (string));
        string memory answer = _normalizeResponse(rawAnswer);

        // Save to chat history
        g.chatRoles.push("assistant");
        g.chatMessages.push(rawAnswer);

        // Store in QA history for frontend display
        g.history.push(QA({
            question: g.pendingQuestion,
            answer: answer
        }));
        g.questionCount++;

        emit QuestionAnswered(gameId, g.pendingQuestion, answer, g.questionCount);

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

        // Add guess to chat history
        string memory guessPrompt = string(abi.encodePacked(
            "My guess is: ", guess, ". Answer with exactly 'correct' or 'incorrect'."
        ));
        g.chatRoles.push("user");
        g.chatMessages.push(guessPrompt);

        // Build inferChat payload with full history
        bytes memory payload = abi.encodeWithSelector(
            ILLMInferenceAgent.inferChat.selector,
            g.chatRoles,
            g.chatMessages,
            false  // chainOfThought: false
        );

        uint256 requestId = PLATFORM.createRequest{value: LLM_DEPOSIT}(
            LLM_AGENT_ID,
            address(this),
            this.handleGuessResponse.selector,
            payload
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

        string memory rawResult = abi.decode(responses[0].result, (string));
        string memory result = _normalizeResponse(rawResult);

        // Save to chat history
        g.chatRoles.push("assistant");
        g.chatMessages.push(rawResult);

        bool isCorrect = _startsWith(result, "correct");

        emit GuessResult(gameId, g.pendingPlayer, g.pendingQuestion, isCorrect);

        if (isCorrect) {
            // WINNER! Refund the gameFee they sent
            (bool refundOk, ) = g.pendingPlayer.call{value: g.gameFee}("");
            if (!refundOk) {} // Continue anyway

            g.winningGuess = g.pendingQuestion;
            _endGameWinner(g, gameId, g.pendingPlayer);
        } else {
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

    // ─────────────────────────────────────────────────────────────
    // Utilities
    // ─────────────────────────────────────────────────────────────

    function _getDifficultyHint(Difficulty difficulty) internal pure returns (string memory) {
        if (difficulty == Difficulty.Easy) {
            return "DIFFICULTY: Pick a VERY FAMOUS person that everyone knows (major celebrity, world leader, legendary historical figure). ";
        } else if (difficulty == Difficulty.Medium) {
            return "DIFFICULTY: Pick a MODERATELY FAMOUS person (known in their field but not a household name). ";
        } else {
            return "DIFFICULTY: Pick an OBSCURE person (lesser-known historical figure, niche celebrity, or someone most people wouldn't recognize). ";
        }
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

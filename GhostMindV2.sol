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
    uint256 public constant MAX_QUESTIONS = 20;
    uint256 public constant PROTOCOL_FEE_BPS = 300; // 3%

    address public immutable feeRecipient;

    // ── System Prompts ────────────────────────────────────────────

    string private constant SYSTEM_PROMPT =
        "You are the game master of a Guess Who guessing game. "
        "At game start, you picked ONE famous real person. "
        "You must be consistent with this character for the entire conversation. "
        "RULES: "
        "1. For YES/NO questions: Answer based on TRUE facts about your character. "
        "2. Be historically accurate (if person lived before their country existed, answer based on their region). "
        "3. Stay consistent with ALL your previous answers shown in the history. "
        "4. For GUESSES: Accept reasonable name variations (partial names, different spellings, with/without titles). "
        "5. If a guess clearly refers to your character, answer 'correct'. Otherwise 'incorrect'. "
        "IMPORTANT: Confirming correct guesses is REQUIRED - the game depends on it.";

    // ── Game State ────────────────────────────────────────────────

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
        uint256 gameFee;
        uint256 pot;
        uint256 questionCount;
        QA[] history;
        string pendingQuestion;  // Current question/guess being processed
        address pendingPlayer;   // Who asked the pending question
        RequestType pendingType; // Type of pending request
        uint256 pendingRequestId;
        address winner;
        string winningGuess;     // The guess that won
        uint256 createdAt;
    }

    mapping(uint256 => Game) public games;
    mapping(uint256 => uint256) public requestToGame;

    uint256 public gameCounter;

    // ── Events ────────────────────────────────────────────────────

    event GameCreated(uint256 indexed gameId, address indexed gameMaster, uint256 pot, uint256 gameFee);
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
    error MaxQuestionsReached(uint256 gameId);
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

    function createGame(uint256 gameFee) external payable returns (uint256 gameId) {
        require(msg.value >= LLM_DEPOSIT, "Must cover LLM init deposit");

        gameId = ++gameCounter;
        Game storage g = games[gameId];

        g.gameMaster = msg.sender;
        g.phase = GamePhase.Initializing;
        g.gameFee = gameFee;
        g.pot = msg.value - LLM_DEPOSIT;
        g.createdAt = block.timestamp;

        // Init prompt - LLM picks a character silently
        string memory initPrompt = string(abi.encodePacked(
            "Game ID: ", _uint2str(gameId), ". ",
            "Pick your secret character now. Remember who you picked. ",
            "Confirm you are ready by saying 'ready'."
        ));

        string[] memory allowed = new string[](1);
        allowed[0] = "ready";

        bytes memory payload = abi.encodeWithSelector(
            ILLMInferenceAgent.inferString.selector,
            initPrompt,
            SYSTEM_PROMPT,
            false,
            allowed
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

        emit GameCreated(gameId, msg.sender, g.pot, gameFee);
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
        if (g.questionCount >= MAX_QUESTIONS) revert MaxQuestionsReached(gameId);

        uint256 required = LLM_DEPOSIT + g.gameFee;
        if (msg.value < required) revert InsufficientPayment(required, msg.value);

        g.pot += g.gameFee;
        _refundExcess(msg.sender, msg.value - required);

        g.phase = GamePhase.Processing;
        g.pendingQuestion = question;
        g.pendingPlayer = msg.sender;
        g.pendingType = RequestType.Question;

        // Build prompt with full history
        string memory prompt = _buildQuestionPrompt(g, question);

        string[] memory allowed = new string[](2);
        allowed[0] = "yes";
        allowed[1] = "no";

        bytes memory payload = abi.encodeWithSelector(
            ILLMInferenceAgent.inferString.selector,
            prompt,
            SYSTEM_PROMPT,
            false,
            allowed
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
            // Refund and reset
            _refundQuestionFee(g, gameId, requestId, status);
            return;
        }

        string memory answer = abi.decode(responses[0].result, (string));

        // Store in history
        g.history.push(QA({
            question: g.pendingQuestion,
            answer: answer
        }));
        g.questionCount++;

        emit QuestionAnswered(gameId, g.pendingQuestion, answer, g.questionCount);

        // Check max questions
        if (g.questionCount >= MAX_QUESTIONS) {
            _endGameNoWinner(g, gameId, "Max questions reached");
        } else {
            g.phase = GamePhase.Active;
        }

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

        // Always require gameFee - refunded if correct
        if (msg.value < g.gameFee) revert InsufficientPayment(g.gameFee, msg.value);

        // Don't add to pot yet - wait for result
        _refundExcess(msg.sender, msg.value - g.gameFee);

        g.phase = GamePhase.Processing;
        g.pendingQuestion = guess;
        g.pendingPlayer = msg.sender;
        g.pendingType = RequestType.Guess;

        // Build prompt with full history + guess
        string memory prompt = _buildGuessPrompt(g, guess);

        string[] memory allowed = new string[](2);
        allowed[0] = "correct";
        allowed[1] = "incorrect";

        bytes memory payload = abi.encodeWithSelector(
            ILLMInferenceAgent.inferString.selector,
            prompt,
            SYSTEM_PROMPT,
            false,
            allowed
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
            // Refund gameFee and reset
            (bool ok, ) = g.pendingPlayer.call{value: g.gameFee}("");
            if (!ok) {} // Log but don't block
            g.phase = GamePhase.Active;
            emit RequestFailed(gameId, requestId, status);
            return;
        }

        string memory result = abi.decode(responses[0].result, (string));
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

            // Store in history for context
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
    // Internal - Prompt Building
    // ─────────────────────────────────────────────────────────────

    function _buildQuestionPrompt(Game storage g, string calldata question) internal view returns (string memory) {
        string memory prompt = string(abi.encodePacked(
            "Game ID: ", _uint2str(uint256(uint160(address(this))) ^ g.createdAt), "\n\n"
        ));

        // Add history
        if (g.history.length > 0) {
            prompt = string(abi.encodePacked(prompt, "## Previous Q&A (stay consistent):\n"));
            for (uint256 i = 0; i < g.history.length; i++) {
                prompt = string(abi.encodePacked(
                    prompt,
                    "Q: ", g.history[i].question, "\n",
                    "A: ", g.history[i].answer, "\n"
                ));
            }
            prompt = string(abi.encodePacked(prompt, "\n"));
        }

        prompt = string(abi.encodePacked(
            prompt,
            "## Current Question:\n",
            question, "\n\n",
            "Answer only 'yes' or 'no'."
        ));

        return prompt;
    }

    function _buildGuessPrompt(Game storage g, string calldata guess) internal view returns (string memory) {
        string memory prompt = string(abi.encodePacked(
            "Game ID: ", _uint2str(uint256(uint160(address(this))) ^ g.createdAt), "\n\n"
        ));

        // Add history
        if (g.history.length > 0) {
            prompt = string(abi.encodePacked(prompt, "## Previous Q&A (stay consistent):\n"));
            for (uint256 i = 0; i < g.history.length; i++) {
                prompt = string(abi.encodePacked(
                    prompt,
                    "Q: ", g.history[i].question, "\n",
                    "A: ", g.history[i].answer, "\n"
                ));
            }
            prompt = string(abi.encodePacked(prompt, "\n"));
        }

        prompt = string(abi.encodePacked(
            prompt,
            "## Player's Guess:\n",
            "The player guesses: \"", guess, "\"\n\n",
            "If this is your character (accept name variations), answer 'correct'.\n",
            "If this is a different person, answer 'incorrect'."
        ));

        return prompt;
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
        uint256 gameFee,
        uint256 pot,
        uint256 questionCount,
        address winner
    ) {
        Game storage g = games[gameId];
        return (g.gameMaster, g.phase, g.gameFee, g.pot, g.questionCount, g.winner);
    }

    function getHistory(uint256 gameId) external view returns (QA[] memory) {
        return games[gameId].history;
    }

    function getActionCost(uint256 gameId) external view returns (uint256 questionCost, uint256 guessCost) {
        Game storage g = games[gameId];
        questionCost = LLM_DEPOSIT + g.gameFee;
        guessCost = LLM_DEPOSIT + g.gameFee; // Now requires LLM call
    }

    // ─────────────────────────────────────────────────────────────
    // Utilities
    // ─────────────────────────────────────────────────────────────

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

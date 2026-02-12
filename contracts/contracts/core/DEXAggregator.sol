// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title DEXAggregator
 * @notice DEX aggregation contract integrating 0x Protocol for optimal swap routing
 * @dev Executes swaps through 0x Exchange Proxy with slippage protection
 */
contract DEXAggregator is Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    // 0x Exchange Proxy address (same on all EVM chains)
    address public constant ZX_EXCHANGE_PROXY = 0xDef1C0ded9bec7F1a1670819833240f027b25EfF;

    // Events
    event SwapExecuted(
        address indexed tokenIn,
        address indexed tokenOut,
        uint256 amountIn,
        uint256 amountOut,
        address indexed recipient
    );

    event EmergencyWithdraw(
        address indexed token,
        uint256 amount,
        address indexed recipient
    );

    // Errors
    error InvalidAddress();
    error InvalidAmount();
    error SwapFailed();
    error InsufficientOutput(uint256 expected, uint256 actual);
    error TransferFailed();

    constructor() Ownable(msg.sender) {}

    /**
     * @notice Execute a swap through 0x Protocol
     * @param tokenIn Address of token to sell
     * @param tokenOut Address of token to buy
     * @param amountIn Amount of tokenIn to sell
     * @param minAmountOut Minimum amount of tokenOut to receive (slippage protection)
     * @param swapCallData Calldata from 0x API quote
     * @param recipient Address to receive the output tokens
     * @return amountOut Actual amount of tokenOut received
     */
    function swap(
        address tokenIn,
        address tokenOut,
        uint256 amountIn,
        uint256 minAmountOut,
        bytes calldata swapCallData,
        address recipient
    ) external nonReentrant returns (uint256 amountOut) {
        if (tokenIn == address(0) || tokenOut == address(0)) revert InvalidAddress();
        if (amountIn == 0) revert InvalidAmount();
        if (recipient == address(0)) revert InvalidAddress();

        // Transfer tokens from sender to this contract
        IERC20(tokenIn).safeTransferFrom(msg.sender, address(this), amountIn);

        // Execute the swap
        amountOut = _executeSwap(tokenIn, tokenOut, amountIn, minAmountOut, swapCallData);

        // Transfer output tokens to recipient
        IERC20(tokenOut).safeTransfer(recipient, amountOut);

        emit SwapExecuted(tokenIn, tokenOut, amountIn, amountOut, recipient);

        return amountOut;
    }

    /**
     * @notice Execute a swap and return to sender
     * @dev Convenience function that uses msg.sender as recipient
     */
    function swapExactInput(
        address tokenIn,
        address tokenOut,
        uint256 amountIn,
        uint256 minAmountOut,
        bytes calldata swapCallData
    ) external nonReentrant returns (uint256 amountOut) {
        if (tokenIn == address(0) || tokenOut == address(0)) revert InvalidAddress();
        if (amountIn == 0) revert InvalidAmount();

        // Transfer tokens from sender to this contract
        IERC20(tokenIn).safeTransferFrom(msg.sender, address(this), amountIn);

        // Execute the swap
        amountOut = _executeSwap(tokenIn, tokenOut, amountIn, minAmountOut, swapCallData);

        // Transfer output tokens back to sender
        IERC20(tokenOut).safeTransfer(msg.sender, amountOut);

        emit SwapExecuted(tokenIn, tokenOut, amountIn, amountOut, msg.sender);

        return amountOut;
    }

    /**
     * @notice Execute swap for CDPShield integration
     * @dev Called by CDPShield contract during position liquidation
     * @param tokenIn Collateral token to sell
     * @param tokenOut Debt token to buy
     * @param amountIn Amount of collateral to swap
     * @param minAmountOut Minimum debt token to receive
     * @param swapCallData 0x API calldata
     * @return amountOut Actual debt token received
     */
    function swapForCDP(
        address tokenIn,
        address tokenOut,
        uint256 amountIn,
        uint256 minAmountOut,
        bytes calldata swapCallData
    ) external nonReentrant returns (uint256 amountOut) {
        if (tokenIn == address(0) || tokenOut == address(0)) revert InvalidAddress();
        if (amountIn == 0) revert InvalidAmount();

        // Tokens should already be in this contract (transferred by CDPShield)
        uint256 tokenInBalance = IERC20(tokenIn).balanceOf(address(this));
        if (tokenInBalance < amountIn) {
            // If not enough, try to transfer from sender
            IERC20(tokenIn).safeTransferFrom(msg.sender, address(this), amountIn - tokenInBalance);
        }

        // Execute the swap
        amountOut = _executeSwap(tokenIn, tokenOut, amountIn, minAmountOut, swapCallData);

        // Transfer output to caller (CDPShield)
        IERC20(tokenOut).safeTransfer(msg.sender, amountOut);

        emit SwapExecuted(tokenIn, tokenOut, amountIn, amountOut, msg.sender);

        return amountOut;
    }

    /**
     * @dev Internal function to execute swap through 0x
     */
    function _executeSwap(
        address tokenIn,
        address tokenOut,
        uint256 amountIn,
        uint256 minAmountOut,
        bytes calldata swapCallData
    ) internal returns (uint256 amountOut) {
        // Approve 0x Exchange Proxy to spend tokens
        IERC20(tokenIn).forceApprove(ZX_EXCHANGE_PROXY, amountIn);

        // Record balance before swap
        uint256 balanceBefore = IERC20(tokenOut).balanceOf(address(this));

        // Execute swap through 0x
        (bool success, ) = ZX_EXCHANGE_PROXY.call(swapCallData);
        if (!success) revert SwapFailed();

        // Calculate actual output
        amountOut = IERC20(tokenOut).balanceOf(address(this)) - balanceBefore;

        // Slippage protection
        if (amountOut < minAmountOut) {
            revert InsufficientOutput(minAmountOut, amountOut);
        }

        // Reset approval
        IERC20(tokenIn).forceApprove(ZX_EXCHANGE_PROXY, 0);

        return amountOut;
    }

    /**
     * @notice Get swap quote preview (view function for UI)
     * @dev This doesn't execute the swap, just returns expected values
     * @param tokenIn Input token address
     * @param tokenOut Output token address
     * @param amountIn Amount to swap
     * @return expectedOut Expected output (this is a rough estimate)
     */
    function getSwapPreview(
        address tokenIn,
        address tokenOut,
        uint256 amountIn
    ) external pure returns (uint256 expectedOut) {
        // This is a placeholder - actual quote should come from 0x API
        // Frontend should call 0x API directly for accurate quotes
        // This function exists for interface compatibility
        if (tokenIn == address(0) || tokenOut == address(0) || amountIn == 0) {
            return 0;
        }
        // Return input amount as placeholder (1:1 ratio)
        // Real implementation would need oracle prices
        return amountIn;
    }

    /**
     * @notice Emergency withdraw stuck tokens
     * @dev Only owner can call this
     * @param token Token to withdraw (address(0) for ETH)
     * @param amount Amount to withdraw
     * @param recipient Address to receive tokens
     */
    function emergencyWithdraw(
        address token,
        uint256 amount,
        address recipient
    ) external onlyOwner {
        if (recipient == address(0)) revert InvalidAddress();

        if (token == address(0)) {
            // Withdraw ETH
            (bool success, ) = recipient.call{value: amount}("");
            if (!success) revert TransferFailed();
        } else {
            // Withdraw ERC20
            IERC20(token).safeTransfer(recipient, amount);
        }

        emit EmergencyWithdraw(token, amount, recipient);
    }

    /**
     * @notice Check if contract can execute swaps
     * @return True if 0x Exchange Proxy is accessible
     */
    function isOperational() external view returns (bool) {
        return ZX_EXCHANGE_PROXY.code.length > 0;
    }

    /**
     * @notice Get the 0x Exchange Proxy address
     * @return The proxy address
     */
    function getExchangeProxy() external pure returns (address) {
        return ZX_EXCHANGE_PROXY;
    }

    // Allow contract to receive ETH (for WETH unwrapping)
    receive() external payable {}
}

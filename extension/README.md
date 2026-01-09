# AutoDocs ✨

**Auto-generate smart code comments as you code. Just save!**

## Features

🚀 **Zero Setup** - Install and start coding. Comments appear automatically.

💡 **Smart Comments** - AI understands your code and generates meaningful documentation.

⚡ **Instant Feedback** - Comments added in seconds after you save.

🎯 **Multi-Language** - TypeScript, JavaScript, Python, Java, Go, Rust, C++, C#

## How It Works

1. **Install** the extension
2. **Open** any code file
3. **Save** after making changes
4. **Magic!** Smart comments appear above your code

```typescript
// Before: No comments
function calculateTax(amount, rate) {
    return amount * rate / 100;
}

// After: AutoDocs adds context
/**
 * Calculates the tax amount based on the given rate percentage.
 * @param amount - The base amount to calculate tax on
 * @param rate - The tax rate as a percentage
 * @returns The calculated tax amount
 */
function calculateTax(amount, rate) {
    return amount * rate / 100;
}
```

## Pricing

| Plan | Comments/Day | Price |
|------|-------------|-------|
| **Free** | 100 | ₹0 |
| **Pro** | 1,000 | ₹10/month |

## Status Bar

The extension shows your remaining comments in the status bar:

- `💡 AutoDocs: 95` - 95 comments remaining today
- `🔥 AutoDocs: 80` - On a streak! 
- `⭐ AutoDocs: 60` - 100+ total comments
- `👑 AutoDocs: 900` - Pro user

## Settings

| Setting | Description |
|---------|-------------|
| `autoreadme.commentStyle` | `short`, `explanatory`, or `pr-review` |
| `autoreadme.apiEndpoint` | Custom API endpoint (advanced) |

## Commands

- **AutoDocs: Show Stats** - View your usage statistics

## Supported Languages

- TypeScript / JavaScript / React
- Python
- Java
- C# / .NET
- Go
- Rust
- C / C++

## Privacy

- No code is stored on our servers
- Code is processed only for comment generation
- Device ID is used for usage tracking only

## Support

Having issues? [Open an issue](https://github.com/autodocs/vscode-extension/issues)

---

Made with 💜 by [Dheeraj Kumar](https://github.com/dheerajkumar)

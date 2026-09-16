package main

import (
	"bufio"
	"fmt"
	"log/slog"
	"os"
	"os/exec"
	"regexp"
	"strings"
	"unicode/utf8"
)

// TunnelResult holds the outcome of starting a tunnel.
type TunnelResult struct {
	URL string // The public tunnel URL
	Cmd *exec.Cmd
}

// promptTunnelChoice asks the user interactively which tunnel option they want.
// Returns "cloudflare" or "none".
func promptTunnelChoice() string {
	fmt.Println()
	fmt.Println("How do you want to expose your server?")
	fmt.Println("[1] Cloudflare Tunnel (requires cloudflared installed)")
	fmt.Println("[2] No tunnel (local network only)")
	fmt.Println()
	fmt.Print("Choose [1-2]: ")

	scanner := bufio.NewScanner(os.Stdin)
	if scanner.Scan() {
		choice := strings.TrimSpace(scanner.Text())
		switch choice {
		case "1":
			return "cloudflare"
		case "2":
			return "none"
		default:
			fmt.Printf("Unknown choice %q, defaulting to no tunnel.\n", choice)
			return "none"
		}
	}
	return "none"
}

// startCloudflareTunnel starts cloudflared as a subprocess and parses the
// generated tunnel URL from its stderr output. It returns a TunnelResult
// on the provided channel once the URL is captured (or an error occurs).
func startCloudflareTunnel(port int, label string, result chan<- TunnelResult) {
	path, err := exec.LookPath("cloudflared")
	if err != nil {
		fmt.Println()
		fmt.Println("Error: cloudflared is not installed or not in PATH.")
		fmt.Println()
		fmt.Println("Install it with one of:")
		fmt.Println("  brew install cloudflared          (macOS)")
		fmt.Println("  sudo apt install cloudflared      (Debian/Ubuntu)")
		fmt.Println("  https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/downloads/")
		fmt.Println()
		fmt.Println("Falling back to local-only mode.")
		result <- TunnelResult{}
		return
	}

	slog.Info("starting cloudflare tunnel", "label", label, "binary", path, "port", port)

	localURL := fmt.Sprintf("http://localhost:%d", port)
	cmd := exec.Command(path, "tunnel", "--url", localURL)

	// cloudflared logs to stderr
	stderr, err := cmd.StderrPipe()
	if err != nil {
		slog.Error("failed to get cloudflared stderr", "label", label, "error", err)
		result <- TunnelResult{}
		return
	}

	if err := cmd.Start(); err != nil {
		slog.Error("failed to start cloudflared", "label", label, "error", err)
		result <- TunnelResult{}
		return
	}

	// Parse stderr looking for the tunnel URL
	urlPattern := regexp.MustCompile(`https://[a-zA-Z0-9-]+\.trycloudflare\.com`)
	sent := false

	go func() {
		scanner := bufio.NewScanner(stderr)
		for scanner.Scan() {
			line := scanner.Text()
			// Forward cloudflared output with a prefix
			fmt.Fprintf(os.Stderr, "[cloudflared:%s] %s\n", label, line)

			if !sent {
				if match := urlPattern.FindString(line); match != "" {
					sent = true
					result <- TunnelResult{
						URL: match,
						Cmd: cmd,
					}
				}
			}
		}

		// If we never found a URL, send an empty result so main doesn't block forever
		if !sent {
			slog.Warn("cloudflared exited without producing a tunnel URL", "label", label)
			result <- TunnelResult{Cmd: cmd}
		}
	}()
}

// printConnectionBox prints a bordered box with server connection info.
func printConnectionBox(serverTunnelURL string, clientTunnelURL string, serverPort int, clientPort int) {
	if serverTunnelURL != "" {
		serverDisplay := strings.TrimPrefix(serverTunnelURL, "https://")
		serverDisplay = strings.TrimPrefix(serverDisplay, "http://")

		lines := []string{
			"ZAFF Game Server is ready!",
			"",
			"Share this server address with your friends:",
			fmt.Sprintf("→ %s", serverDisplay),
		}

		if clientTunnelURL != "" {
			lines = append(lines,
				"",
				"Dev client (remote testing):",
				fmt.Sprintf("→ %s", clientTunnelURL),
			)
		}

		lines = append(lines,
			"",
			"Press Ctrl+C to stop",
		)
		printBox(lines)
	} else {
		lines := []string{
			"ZAFF Game Server is ready!",
			"",
			fmt.Sprintf("Server:  localhost:%d", serverPort),
		}
		if clientPort > 0 {
			lines = append(lines, fmt.Sprintf("Client:  localhost:%d", clientPort))
		}
		lines = append(lines,
			"",
			"Press Ctrl+C to stop",
		)
		printBox(lines)
	}
}

// printBox prints lines inside a Unicode box-drawing border.
func printBox(lines []string) {
	// Find the widest line (rune count, not byte count, for correct alignment
	// with multi-byte characters like →)
	maxWidth := 0
	for _, line := range lines {
		w := utf8.RuneCountInString(line)
		if w > maxWidth {
			maxWidth = w
		}
	}
	// Add padding on each side
	boxWidth := maxWidth + 4

	fmt.Println()
	// Top border
	fmt.Printf("╔%s╗\n", strings.Repeat("═", boxWidth))
	for _, line := range lines {
		padding := boxWidth - utf8.RuneCountInString(line) - 4
		if padding < 0 {
			padding = 0
		}
		fmt.Printf("║  %s%s  ║\n", line, strings.Repeat(" ", padding))
	}
	// Bottom border
	fmt.Printf("╚%s╝\n", strings.Repeat("═", boxWidth))
	fmt.Println()
}

package main

import (
	"context"
	"encoding/json"
	"log/slog"
	"sync"
	"time"

	"github.com/coder/websocket"
)

// Client wraps a WebSocket connection and player metadata.
type Client struct {
	Conn       *websocket.Conn
	PlayerID   string
	PlayerName string
	Room       *Room

	sendMu sync.Mutex
}

// Send writes raw JSON data to the WebSocket connection (thread-safe).
func (c *Client) Send(data []byte) {
	c.sendMu.Lock()
	defer c.sendMu.Unlock()

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	if err := c.Conn.Write(ctx, websocket.MessageText, data); err != nil {
		slog.Warn("failed to send message to client",
			"playerId", c.PlayerID,
			"error", err,
		)
	}
}

// SendMsg marshals and sends a ServerMessage.
func (c *Client) SendMsg(msg ServerMessage) {
	data, err := json.Marshal(msg)
	if err != nil {
		slog.Error("failed to marshal server message", "error", err)
		return
	}
	c.Send(data)
}

// ReadLoop reads messages from the WebSocket and dispatches them to the room.
// It blocks until the connection is closed or an error occurs.
func (c *Client) ReadLoop(ctx context.Context) {
	for {
		_, data, err := c.Conn.Read(ctx)
		if err != nil {
			// Connection closed — not necessarily an error
			slog.Info("client read loop ended",
				"playerId", c.PlayerID,
				"error", err,
			)
			return
		}

		var cm ClientMessage
		if err := json.Unmarshal(data, &cm); err != nil {
			c.SendMsg(ServerMessage{
				Msg:   MsgError,
				Error: "invalid message format",
			})
			continue
		}

		c.handleMessage(cm)
	}
}

func (c *Client) handleMessage(cm ClientMessage) {
	switch cm.Msg {
	case MsgAction:
		if cm.Action == nil {
			c.SendMsg(ServerMessage{
				Msg:   MsgError,
				Error: "action field is required",
			})
			return
		}
		if err := c.Room.ProcessAction(*cm.Action, c.PlayerID); err != nil {
			c.SendMsg(ServerMessage{
				Msg:   MsgError,
				Error: err.Error(),
			})
		}

	case MsgUndo:
		if cm.Seq == 0 {
			c.SendMsg(ServerMessage{
				Msg:   MsgError,
				Error: "seq field is required for UNDO",
			})
			return
		}
		if err := c.Room.ProcessUndo(cm.Seq, c.PlayerID); err != nil {
			c.SendMsg(ServerMessage{
				Msg:    MsgError,
				Error:  err.Error(),
				RefSeq: cm.Seq,
			})
		}

	case MsgPing:
		c.SendMsg(ServerMessage{Msg: MsgPong})

	default:
		c.SendMsg(ServerMessage{
			Msg:   MsgError,
			Error: "unknown message type: " + cm.Msg,
		})
	}
}

package main

// GameState represents the full state of a game room.
type GameState struct {
	Players map[string]*Player  `json:"players"`
	Cards   map[string]*Card    `json:"cards"`
	Zones   map[string][]string `json:"zones"`
}

// Player represents a connected player.
type Player struct {
	Name      string `json:"name"`
	Life      int    `json:"life"`
	Connected bool   `json:"connected"`
}

// Card represents a card instance on the table.
type Card struct {
	InstanceID string         `json:"instanceId"`
	CardID     string         `json:"cardId"`
	ImageURL   string         `json:"imageUrl"`
	OwnerID    string         `json:"ownerId"`
	Zone       string         `json:"zone"`
	ZoneIndex  int            `json:"zoneIndex"`
	X          float64        `json:"x"`
	Y          float64        `json:"y"`
	Rotation   float64        `json:"rotation"`
	FaceDown   bool           `json:"faceDown"`
	Counters   map[string]int `json:"counters"`
}

// NewGameState creates an empty game state with initialized maps.
func NewGameState() *GameState {
	return &GameState{
		Players: make(map[string]*Player),
		Cards:   make(map[string]*Card),
		Zones:   make(map[string][]string),
	}
}

// PlayerZones are the per-player zone suffixes.
var PlayerZones = []string{"deck", "hand", "battlefield", "graveyard", "exile"}

// EnsurePlayerZones creates all zone entries for a player if they don't exist.
func (gs *GameState) EnsurePlayerZones(playerID string) {
	for _, z := range PlayerZones {
		key := playerID + ":" + z
		if _, ok := gs.Zones[key]; !ok {
			gs.Zones[key] = []string{}
		}
	}
	// Shared stack zone
	if _, ok := gs.Zones["shared:stack"]; !ok {
		gs.Zones["shared:stack"] = []string{}
	}
}

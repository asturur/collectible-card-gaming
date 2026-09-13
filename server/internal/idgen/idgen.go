// Package idgen provides UUID generation for card instance IDs.
// The generator function is replaceable for deterministic testing.
package idgen

import (
	"crypto/rand"
	"fmt"
)

// Generator is the function used to generate IDs. Replace it in tests
// for deterministic output.
var Generator func() string = defaultGenerator

// New returns a new unique ID using the current Generator.
func New() string {
	return Generator()
}

func defaultGenerator() string {
	b := make([]byte, 16)
	_, _ = rand.Read(b)
	// Set version 4 and variant bits
	b[6] = (b[6] & 0x0f) | 0x40
	b[8] = (b[8] & 0x3f) | 0x80
	return fmt.Sprintf("%08x-%04x-%04x-%04x-%012x",
		b[0:4], b[4:6], b[6:8], b[8:10], b[10:16])
}

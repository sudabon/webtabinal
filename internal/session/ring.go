package session

import "sync"

type RingBuffer struct {
	mu   sync.Mutex
	buf  []byte
	size int
	max  int
}

func NewRingBuffer(max int) *RingBuffer {
	if max <= 0 {
		max = 5 * 1024 * 1024
	}
	return &RingBuffer{max: max}
}

func (r *RingBuffer) Write(p []byte) {
	r.mu.Lock()
	defer r.mu.Unlock()
	if len(p) >= r.max {
		r.buf = append([]byte(nil), p[len(p)-r.max:]...)
		r.size = len(r.buf)
		return
	}
	need := r.size + len(p) - r.max
	if need > 0 {
		if need >= r.size {
			r.buf = nil
			r.size = 0
		} else {
			r.buf = append([]byte(nil), r.buf[need:]...)
			r.size = len(r.buf)
		}
	}
	r.buf = append(r.buf, p...)
	r.size = len(r.buf)
}

func (r *RingBuffer) Bytes() []byte {
	r.mu.Lock()
	defer r.mu.Unlock()
	out := make([]byte, len(r.buf))
	copy(out, r.buf)
	return out
}

func (r *RingBuffer) Len() int {
	r.mu.Lock()
	defer r.mu.Unlock()
	return r.size
}

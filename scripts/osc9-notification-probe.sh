#!/bin/sh

set -eu

if ! printf '\033]9;WebTabinal OSC 9 probe\007' > /dev/tty; then
  printf '%s\n' 'Could not write OSC 9 to /dev/tty. Run this probe in a WebTabinal terminal.' >&2
  exit 1
fi

printf '%s\n' 'Sent the WebTabinal OSC 9 notification probe.'

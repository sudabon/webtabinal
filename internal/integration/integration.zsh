# WebTabinal zsh integration v1
# Guard: only active inside WebTabinal sessions
[[ -z "$WEBTABINAL_SESSION_ID" ]] && return

__webtabinal_osc() {
  printf '\033]%s\033\\' "$1"
}

__webtabinal_cwd() {
  local encoded
  encoded=$(python3 -c 'import os,urllib.parse; print(urllib.parse.quote(os.getcwd(), safe="/"))' 2>/dev/null) || encoded="${PWD}"
  __webtabinal_osc "7;file://${encoded}"
}

__webtabinal_precmd() {
  local code=$?
  __webtabinal_osc "133;D;${code}"
  __webtabinal_cwd
  __webtabinal_osc "133;A"
}

__webtabinal_preexec() {
  local b64
  b64=$(printf '%s' "$1" | base64 | tr -d '\n')
  __webtabinal_osc "9973;cmd;${b64}"
  __webtabinal_osc "133;C"
}

autoload -Uz add-zsh-hook
add-zsh-hook precmd __webtabinal_precmd
add-zsh-hook preexec __webtabinal_preexec
add-zsh-hook chpwd __webtabinal_cwd

# Initial CWD
__webtabinal_cwd

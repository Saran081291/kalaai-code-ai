#!/usr/bin/env bash
# Print the settings Kalaai Code needs from an EXISTING Traefik on this server.
#   bash deploy/discover-traefik.sh
# It only reads (docker ps / docker inspect); it changes nothing.
set -u

if ! command -v docker >/dev/null 2>&1; then
  echo "docker is not installed or not on PATH." >&2
  exit 1
fi

# Container whose image name contains "traefik"
line="$(docker ps --format '{{.Names}}|{{.Image}}' | grep -i traefik | head -n 1 || true)"
if [ -z "$line" ]; then
  echo "No running Traefik container found (looked for an image containing 'traefik')."
  echo "Running containers:"
  docker ps --format '  {{.Names}}  ({{.Image}})'
  echo
  echo "If your proxy is not Traefik, this override does not apply - see deploy/DEPLOY.md."
  exit 2
fi
name="${line%%|*}"
image="${line#*|}"
echo "Traefik container : $name  ($image)"

echo
echo "== Traefik network(s) (informational) =="
docker inspect -f '{{range $k, $v := .NetworkSettings.Networks}}{{$k}}{{"\n"}}{{end}}' "$name" | sed '/^$/d' | sed 's/^/  /'
echo "  -> 'host' = host network mode: Traefik reaches containers directly, nothing to set."

# Static config arrives as command-line args (compose 'command:') or via a file.
args="$(docker inspect -f '{{join .Args " "}} {{join .Config.Cmd " "}}' "$name" 2>/dev/null || true)"

echo
echo "== TRAEFIK_CERTRESOLVER  (certificate resolver name) =="
resolvers="$(printf '%s\n' "$args" | tr ' ' '\n' | grep -o 'certificatesresolvers\.[^.=]*' | sed 's/certificatesresolvers\.//' | sort -u || true)"
if [ -n "$resolvers" ]; then printf '%s\n' "$resolvers" | sed 's/^/  /'; else
  echo "  (not found in the container's arguments - it may be defined in a config file;"
  echo "   check the labels of an app that already has HTTPS, e.g.:"
  echo "   docker inspect -f '{{json .Config.Labels}}' <n8n-container> | tr ',' '\\n' | grep certresolver)"
fi

echo
echo "== TRAEFIK_ENTRYPOINT  (HTTPS entrypoint name) =="
eps="$(printf '%s\n' "$args" | tr ' ' '\n' | grep -o 'entrypoints\.[^.=]*\.address=[^ ]*' | sed 's/^entrypoints\.//' || true)"
if [ -n "$eps" ]; then printf '%s\n' "$eps" | sed 's/^/  /'; echo "  -> use the one with address :443 (usually websecure)"; else
  echo "  (not found in arguments; websecure is the common default)"
fi

echo
echo "== Other containers using Traefik labels (for reference) =="
for c in $(docker ps --format '{{.Names}}'); do
  if docker inspect -f '{{json .Config.Labels}}' "$c" 2>/dev/null | grep -q 'traefik.enable'; then
    echo "  $c"
  fi
done

echo
echo "Put the resolver and entrypoint into .env as TRAEFIK_CERTRESOLVER and TRAEFIK_ENTRYPOINT."

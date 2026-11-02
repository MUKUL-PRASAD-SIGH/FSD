#!/usr/bin/env bash
# Installs the development toolchain used for HackElite on Linux x86_64 without root package repos:
#   - MongoDB 8.0 server (conda-forge build; works where fastdl.mongodb.org is unreachable)
#   - Ghidra 12.1.4 (official GitHub release; REA 6.x supports Ghidra 12.1.x, and 12.2 needs JDK 25)
#   - REA (rea-agents from npm)
# Requirements already on the machine: Node 20+, npm, Python 3, a full JDK 21 (javac present), unzip, curl.
# Usage: TOOLS=/opt/tools bash scripts/setup-dev-tools.sh   then   source $TOOLS/env.sh
set -euo pipefail
TOOLS="${TOOLS:-/opt/tools}"
GHIDRA_VER=12.1.4
GHIDRA_DATE=20260921
MONGO_PKG=mongodb-8.0.23-h8ca7601_0.conda
mkdir -p "$TOOLS" "$TOOLS/mongodata" "$TOOLS/logs"
cd "$TOOLS"

if [ ! -x "$TOOLS/mongodb/bin/mongod" ]; then
  echo "==> MongoDB"
  python3 -m pip install -q zstandard
  mkdir -p mongodb && cd mongodb
  curl -fsSL -o m.conda "https://conda.anaconda.org/conda-forge/linux-64/$MONGO_PKG"
  python3 - <<'EOF'
import zipfile, zstandard, tarfile, io
z = zipfile.ZipFile('m.conda')
for n in z.namelist():
    if n.startswith('pkg-'):
        data = zstandard.ZstdDecompressor().stream_reader(z.open(n)).read()
        tarfile.open(fileobj=io.BytesIO(data), mode='r|').extractall('.', filter='data')
EOF
  rm m.conda && cd "$TOOLS"
fi

if [ ! -d "$TOOLS/ghidra_${GHIDRA_VER}_PUBLIC" ]; then
  echo "==> Ghidra $GHIDRA_VER"
  curl -fsSL -o g.zip "https://github.com/NationalSecurityAgency/ghidra/releases/download/Ghidra_${GHIDRA_VER}_build/ghidra_${GHIDRA_VER}_PUBLIC_${GHIDRA_DATE}.zip"
  unzip -q g.zip && rm g.zip
fi
JDK="$(dirname "$(dirname "$(readlink -f "$(command -v javac)")")")"
# Ghidra's launcher cannot parse the JDK version when JAVA_TOOL_OPTIONS prints a banner, so pin it.
sed -i "s|^JAVA_HOME_OVERRIDE=.*|JAVA_HOME_OVERRIDE=$JDK|" "$TOOLS/ghidra_${GHIDRA_VER}_PUBLIC/support/launch.properties"

echo "==> REA"
npm install -g rea-agents >/dev/null

cat > "$TOOLS/env.sh" <<EOF
export PATH="$TOOLS/mongodb/bin:\$PATH"
export GHIDRA_INSTALL_DIR="$TOOLS/ghidra_${GHIDRA_VER}_PUBLIC"
export JAVA_HOME="$JDK"
start_mongo() { mongod --dbpath "$TOOLS/mongodata" --bind_ip 127.0.0.1 --port 27017 --fork --logpath "$TOOLS/logs/mongod.log"; }
EOF
echo "Done. Run: source $TOOLS/env.sh && start_mongo && rea doctor"

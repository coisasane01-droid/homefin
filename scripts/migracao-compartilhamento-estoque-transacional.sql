cd /workspaces/homefin

echo "========== VALIDAR API =========="
node --check api/inventory.js

echo "========== COMPILAR PROJETO =========="
npm run build

echo "========== STATUS DOS ARQUIVOS =========="
git status --short

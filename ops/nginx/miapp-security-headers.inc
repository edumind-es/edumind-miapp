# Cabeceras de seguridad de miapp.
# Se incluye DENTRO de cada location que declare add_header propio:
# nginx descarta todas las cabeceras heredadas del server en cuanto un
# bloque hijo declara la suya. Generado por
# (desplegar en /etc/nginx/sites-available/ junto al site).

add_header Strict-Transport-Security "max-age=31536000; includeSubDomains; preload" always;
add_header X-Content-Type-Options "nosniff" always;
add_header X-Frame-Options "SAMEORIGIN" always;
add_header X-XSS-Protection "0" always;
add_header Referrer-Policy "strict-origin-when-cross-origin" always;
add_header Permissions-Policy "camera=(), microphone=(), geolocation=()" always;
add_header Content-Security-Policy "default-src 'self'; base-uri 'self'; frame-ancestors 'self'; object-src 'none'; form-action 'self'; script-src 'self' 'wasm-unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob: https:; font-src 'self' data:; connect-src 'self' https: wss: http://127.0.0.1:11434 http://localhost:11434; worker-src 'self' blob:; media-src 'self' blob:;" always;

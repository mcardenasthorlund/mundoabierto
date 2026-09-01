# Imagen para el juego Mundo Abierto 3D (servidor Node + WebSocket)
FROM node:20-alpine

WORKDIR /app

# Instalamos dependencias primero (mejor aprovechamiento de caché)
COPY server/package*.json ./server/
RUN npm install --prefix server

# Código del servidor y archivos estáticos
COPY server ./server
COPY index.html css js ./

ENV PORT=8080
ENV MAX_PLAYERS=4
EXPOSE 8080

CMD ["node", "server/server.js"]
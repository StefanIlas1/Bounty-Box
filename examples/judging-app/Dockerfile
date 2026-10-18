FROM node:22-alpine
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev --ignore-scripts
COPY server.mjs diagnostic.mjs ./
USER node
EXPOSE 3000
CMD ["node", "server.mjs"]

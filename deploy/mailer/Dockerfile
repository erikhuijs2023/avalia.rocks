FROM node:22-alpine
WORKDIR /app

# Install only production deps for a small image
COPY package.json ./
RUN npm install --omit=dev --no-audit --no-fund && npm cache clean --force

COPY index.mjs ./

# Drop privileges
USER node

EXPOSE 8086
CMD ["node", "index.mjs"]

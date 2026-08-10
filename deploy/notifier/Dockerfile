FROM node:22-alpine
WORKDIR /app

# No runtime npm deps — vanilla node:http + fetch.
COPY package.json index.mjs ./

# Drop privileges.
USER node

EXPOSE 8088
CMD ["node", "index.mjs"]

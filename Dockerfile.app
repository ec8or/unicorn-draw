FROM node:20-alpine

WORKDIR /app
COPY . /app

ENV PORT=8080
ENV DATA_DIR=/data

EXPOSE 8080

# No deps, just Node stdlib.
CMD ["node", "server.mjs"]



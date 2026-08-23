FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
RUN npm install --omit=dev

COPY . .

EXPOSE 4000

# Runs migrate (sync) then starts the server; seeding is a separate manual
# step (`docker compose exec backend npm run seed`) so it's never run
# accidentally against a database that already has real data.
CMD ["sh", "-c", "node src/db/migrate.js && node src/server.js"]

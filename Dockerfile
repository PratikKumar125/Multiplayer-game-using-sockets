FROM node:alpine
WORKDIR /app
EXPOSE 9001
COPY package.json .
RUN npm install
COPY . .
CMD [ "node", "server2.js" ]
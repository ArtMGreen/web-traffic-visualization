FROM node:18-alpine
WORKDIR /app
COPY . .
RUN npm install && npm run build
EXPOSE 3000:5173
CMD ["npm", "run", "dev", "--", "--host"]


FROM node:18-alpine

WORKDIR /app

# Install Python and other build dependencies
RUN apk add --no-cache \
    python3 \
    make \
    g++ \
    && ln -s /usr/bin/python3 /usr/bin/python

# Install dependencies
COPY package*.json ./
RUN npm install

# Copy source code
COPY . .

# Build TypeScript files
RUN npm run build

CMD ["npm", "run", "start"]
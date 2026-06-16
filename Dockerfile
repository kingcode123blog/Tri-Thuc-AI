# Sử dụng môi trường Node.js có sẵn trên Linux
FROM node:24-slim

# Cài đặt Pandoc trực tiếp vào hệ thống của Docker
RUN apt-get update && apt-get install -y pandoc && rm -rf /var/lib/apt/lists/*

# Tạo thư mục làm việc trong máy chủ
WORKDIR /app

# Copy các file quản lý thư viện vào trước để cài đặt
COPY package*.json ./
RUN npm install --production

# Copy toàn bộ code còn lại vào máy chủ
COPY . .

# Mở cổng kết nối (Render sẽ tự cấu hình cổng này)
EXPOSE 3000

# Lệnh khởi chạy server
CMD ["node", "server.js"]

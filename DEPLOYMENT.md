# AWS Deployment Guide for MoveInSync

This guide covers deploying MoveInSync to AWS using various services.

## Prerequisites

- AWS Account
- AWS CLI configured
- Docker installed (for local testing)
- PostgreSQL database (RDS recommended for production)

## Architecture Options

### Option 1: AWS ECS (Elastic Container Service) - Recommended
- **Backend**: ECS Fargate with Application Load Balancer
- **Frontend**: S3 + CloudFront
- **Database**: RDS PostgreSQL
- **Best for**: Production workloads, auto-scaling

### Option 2: AWS EC2
- **Backend**: EC2 instance with Docker
- **Frontend**: EC2 instance with Nginx
- **Database**: RDS PostgreSQL
- **Best for**: Cost-effective, full control

### Option 3: AWS Elastic Beanstalk
- **Backend**: Elastic Beanstalk Python platform
- **Frontend**: S3 + CloudFront
- **Database**: RDS PostgreSQL
- **Best for**: Quick deployment, managed service

## Environment Variables

### Backend (.env)
```bash
# Database (Required for production)
DATABASE_URL=postgresql://user:password@host:5432/dbname

# OpenAI (Required)
OPENAI_API_KEY=your_openai_api_key

# Environment
ENVIRONMENT=production

# CORS (Required for production)
ALLOWED_ORIGINS=https://yourdomain.com,https://www.yourdomain.com

# Optional - LangSmith
LANGCHAIN_TRACING_V2=true
LANGCHAIN_API_KEY=your_langsmith_key
LANGCHAIN_PROJECT=MoveInSync

# Optional - LiveKit
LIVEKIT_URL=wss://your-livekit-server.com
LIVEKIT_API_KEY=your_livekit_key
LIVEKIT_API_SECRET=your_livekit_secret
```

### Frontend (.env)
```bash
VITE_API_URL=https://api.yourdomain.com
VITE_MAPBOX_ACCESS_TOKEN=your_mapbox_token
```

## Deployment Steps

### 1. Set Up RDS PostgreSQL Database

```bash
# Create RDS PostgreSQL instance via AWS Console or CLI
aws rds create-db-instance \
  --db-instance-identifier moveinsync-db \
  --db-instance-class db.t3.micro \
  --engine postgres \
  --master-username moveinsync \
  --master-user-password YourSecurePassword \
  --allocated-storage 20 \
  --vpc-security-group-ids sg-xxxxx
```

### 2. Build and Push Docker Images

```bash
# Build backend image
cd backend
docker build -t moveinsync-backend:latest .

# Build frontend image
cd ../frontend
docker build -t moveinsync-frontend:latest .

# Tag for ECR (replace with your account ID and region)
aws ecr get-login-password --region us-east-1 | docker login --username AWS --password-stdin 123456789012.dkr.ecr.us-east-1.amazonaws.com

docker tag moveinsync-backend:latest 123456789012.dkr.ecr.us-east-1.amazonaws.com/moveinsync-backend:latest
docker tag moveinsync-frontend:latest 123456789012.dkr.ecr.us-east-1.amazonaws.com/moveinsync-frontend:latest

docker push 123456789012.dkr.ecr.us-east-1.amazonaws.com/moveinsync-backend:latest
docker push 123456789012.dkr.ecr.us-east-1.amazonaws.com/moveinsync-frontend:latest
```

### 3. Deploy Backend to ECS

1. Create ECR repository
2. Create ECS cluster
3. Create task definition with environment variables
4. Create service with Application Load Balancer
5. Configure security groups (allow port 8000)

### 4. Deploy Frontend to S3 + CloudFront

```bash
# Build frontend
cd frontend
npm run build

# Upload to S3
aws s3 sync dist/ s3://your-bucket-name --delete

# Create CloudFront distribution pointing to S3 bucket
```

### 5. Initialize Database

```bash
# Connect to your RDS instance and run migrations
export DATABASE_URL=postgresql://user:password@host:5432/dbname
cd backend
python seed_data.py
```

## Local Testing with Docker Compose

```bash
# Start all services
docker-compose up -d

# View logs
docker-compose logs -f

# Stop services
docker-compose down
```

## Health Checks

- Backend: `GET /health` - Returns `{"status": "healthy"}`
- Frontend: Served via Nginx on port 80

## Security Considerations

1. **CORS**: Update `ALLOWED_ORIGINS` in production
2. **Database**: Use RDS with VPC security groups
3. **Secrets**: Use AWS Secrets Manager for API keys
4. **HTTPS**: Use Application Load Balancer with SSL certificate
5. **Environment Variables**: Never commit `.env` files

## Monitoring

- CloudWatch Logs for application logs
- CloudWatch Metrics for performance
- RDS Performance Insights for database
- AWS X-Ray for distributed tracing (optional)

## Scaling

- **ECS**: Configure auto-scaling based on CPU/memory
- **RDS**: Enable Multi-AZ for high availability
- **CloudFront**: Automatic global CDN distribution

## Cost Optimization

- Use Fargate Spot for non-critical workloads
- Use RDS Reserved Instances for predictable workloads
- Enable S3 lifecycle policies for old logs
- Use CloudFront caching to reduce backend load

## Troubleshooting

### Backend not connecting to database
- Check security group rules
- Verify DATABASE_URL format
- Check RDS endpoint accessibility

### CORS errors
- Verify ALLOWED_ORIGINS includes your frontend URL
- Check Application Load Balancer configuration

### Frontend API calls failing
- Verify VITE_API_URL points to correct backend URL
- Check CORS configuration
- Verify SSL certificates

## Support

For issues, check:
- CloudWatch Logs
- ECS Task logs
- RDS Performance Insights
- Application health check endpoint


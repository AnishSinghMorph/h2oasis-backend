# Kubernetes Manifests for H2Oasis Backend

This directory contains Kubernetes YAML files to deploy the H2Oasis backend to Kubernetes.

## 📁 Files Overview

### 1. `namespace.yaml`
Creates an isolated namespace called `h2oasis` for all your resources.

### 2. `configmap.yaml`
Stores non-sensitive configuration (environment variables like `NODE_ENV`, `REDIS_URL`).

### 3. `redis.yaml`
- **Deployment**: Runs Redis cache (1 replica)
- **Service**: Exposes Redis internally as `redis:6379`

### 4. `backend.yaml`
- **Deployment**: Runs your Node.js backend (2 replicas for HA)
- **Service**: Exposes backend on port 30000 (NodePort for local testing)

## 🚀 Deploy to Local Kubernetes (Minikube)

### Step 1: Apply all manifests
```bash
# Deploy everything in order
kubectl apply -f k8s/namespace.yaml
kubectl apply -f k8s/configmap.yaml
kubectl apply -f k8s/redis.yaml
kubectl apply -f k8s/backend.yaml
```

### Step 2: Check deployment status
```bash
# Check all resources
kubectl get all -n h2oasis

# Watch pods starting up
kubectl get pods -n h2oasis -w

# Check logs
kubectl logs -n h2oasis -l app=h2oasis-backend
```

### Step 3: Access your backend
```bash
# Get the Minikube IP
minikube ip

# Access backend at:
# http://<minikube-ip>:30000/health
```

## 🔐 Secrets Management

**Important:** Sensitive data (API keys, database passwords) should be stored in Kubernetes Secrets, not ConfigMaps.

### Create secrets manually:
```bash
kubectl create secret generic h2oasis-backend-secrets \
  --from-literal=mongodb-uri="mongodb+srv://..." \
  --from-literal=openai-api-key="sk-..." \
  --from-literal=firebase-private-key="..." \
  -n h2oasis
```

Then uncomment the `env` section in `backend.yaml` to use these secrets.

## 📊 Useful Commands

```bash
# View all resources in namespace
kubectl get all -n h2oasis

# Describe a pod (detailed info)
kubectl describe pod <pod-name> -n h2oasis

# View logs
kubectl logs -f <pod-name> -n h2oasis

# Execute command in pod
kubectl exec -it <pod-name> -n h2oasis -- /bin/sh

# Delete everything
kubectl delete namespace h2oasis

# Scale backend
kubectl scale deployment h2oasis-backend --replicas=3 -n h2oasis

# Update image (rolling update)
kubectl set image deployment/h2oasis-backend \
  backend=morphdigital/h2oasis-backend:v2.0.0 -n h2oasis
```

## 🌍 Deploy to AWS EKS (Later)

When you have AWS access, you'll:
1. Create an EKS cluster
2. Change `NodePort` to `LoadBalancer` in `backend.yaml`
3. Use AWS Secrets Manager or External Secrets Operator
4. Set up AWS Application Load Balancer Ingress Controller
5. Configure SSL with AWS Certificate Manager

## 🎯 Current Status

- ✅ Local development with Minikube
- ⏳ AWS EKS deployment (pending AWS access)
- ⏳ Production secrets management
- ⏳ Monitoring and logging

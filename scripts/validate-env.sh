#!/bin/bash

# Dev-Ex Platform Environment Validation Script
# This script validates that all required environment variables are set
# and meet security requirements

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo "🔍 Validating environment configuration..."
echo ""

# Track validation status
VALIDATION_FAILED=0
WARNINGS=0

# Function to check if variable is set
check_required() {
    local var_name=$1
    local var_value="${!var_name}"
    
    if [[ -z "$var_value" ]]; then
        echo -e "${RED}❌ ERROR: $var_name is not set${NC}"
        VALIDATION_FAILED=1
        return 1
    else
        echo -e "${GREEN}✓ $var_name is set${NC}"
        return 0
    fi
}

# Function to check if variable contains default/weak value
check_not_default() {
    local var_name=$1
    local var_value="${!var_name}"
    local default_pattern=$2
    
    if [[ "$var_value" == *"$default_pattern"* ]] || [[ "$var_value" == *"CHANGE"* ]]; then
        echo -e "${RED}❌ ERROR: $var_name contains default/weak value${NC}"
        VALIDATION_FAILED=1
        return 1
    fi
    return 0
}

# Function to validate secret strength (minimum 32 characters)
check_secret_strength() {
    local var_name=$1
    local var_value="${!var_name}"
    
    if [[ ${#var_value} -lt 32 ]]; then
        echo -e "${YELLOW}⚠ WARNING: $var_name should be at least 32 characters long (current: ${#var_value})${NC}"
        WARNINGS=$((WARNINGS + 1))
        return 1
    fi
    return 0
}

# Function to validate password complexity
check_password_strength() {
    local var_name=$1
    local var_value="${!var_name}"
    
    if [[ ${#var_value} -lt 12 ]]; then
        echo -e "${YELLOW}⚠ WARNING: $var_name should be at least 12 characters long${NC}"
        WARNINGS=$((WARNINGS + 1))
    fi
    
    if ! [[ "$var_value" =~ [A-Z] ]]; then
        echo -e "${YELLOW}⚠ WARNING: $var_name should contain uppercase letters${NC}"
        WARNINGS=$((WARNINGS + 1))
    fi
    
    if ! [[ "$var_value" =~ [a-z] ]]; then
        echo -e "${YELLOW}⚠ WARNING: $var_name should contain lowercase letters${NC}"
        WARNINGS=$((WARNINGS + 1))
    fi
    
    if ! [[ "$var_value" =~ [0-9] ]]; then
        echo -e "${YELLOW}⚠ WARNING: $var_name should contain numbers${NC}"
        WARNINGS=$((WARNINGS + 1))
    fi
    
    if ! [[ "$var_value" =~ [^a-zA-Z0-9] ]]; then
        echo -e "${YELLOW}⚠ WARNING: $var_name should contain special characters${NC}"
        WARNINGS=$((WARNINGS + 1))
    fi
}

# Load environment file
if [[ -f .env ]]; then
    export $(cat .env | grep -v '^#' | xargs)
    echo -e "${GREEN}✓ .env file loaded${NC}"
else
    echo -e "${RED}❌ ERROR: .env file not found${NC}"
    echo "Please copy .env.example to .env and configure it"
    exit 1
fi

echo ""
echo "📋 Checking required environment variables..."
echo ""

# Critical Security Variables
echo "🔐 Security Configuration:"
check_required "JWT_SECRET"
check_not_default "JWT_SECRET" "CHANGE-THIS"
check_secret_strength "JWT_SECRET"

check_required "JWT_REFRESH_SECRET"
check_not_default "JWT_REFRESH_SECRET" "CHANGE-THIS"
check_secret_strength "JWT_REFRESH_SECRET"

check_required "SESSION_SECRET"
check_not_default "SESSION_SECRET" "CHANGE-THIS"
check_secret_strength "SESSION_SECRET"

check_required "N8N_ENCRYPTION_KEY"
check_not_default "N8N_ENCRYPTION_KEY" "CHANGE-THIS"
check_secret_strength "N8N_ENCRYPTION_KEY"

echo ""
echo "🔑 API Keys:"
check_required "GEMINI_API_KEY"
check_not_default "GEMINI_API_KEY" "your-"

echo ""
echo "🗄️ Database Configuration:"
check_required "DB_PASSWORD"
check_not_default "DB_PASSWORD" "CHANGE-THIS"
check_password_strength "DB_PASSWORD"

check_required "DB_NAME"
check_required "DB_USER"
check_required "DB_HOST"
check_required "DATABASE_URL"

echo ""
echo "💾 Redis Configuration:"
check_required "REDIS_PASSWORD"
check_not_default "REDIS_PASSWORD" "CHANGE-THIS"
check_password_strength "REDIS_PASSWORD"

check_required "REDIS_URL"

echo ""
echo "👤 N8N Authentication:"
check_required "N8N_USER"
check_not_default "N8N_USER" "CHANGE-THIS"

check_required "N8N_PASSWORD"
check_not_default "N8N_PASSWORD" "CHANGE-THIS"
check_password_strength "N8N_PASSWORD"

echo ""
echo "🔧 Application Configuration:"
check_required "NODE_ENV"
check_required "PYTHON_ENV"
check_required "LOG_LEVEL"

# Optional but recommended
echo ""
echo "📊 Optional Configuration:"
[[ -z "$CORS_ORIGIN" ]] && echo -e "${YELLOW}⚠ WARNING: CORS_ORIGIN not set (defaulting to http://localhost:3000)${NC}" && WARNINGS=$((WARNINGS + 1))
[[ -z "$RATE_LIMIT_WINDOW_MS" ]] && echo -e "${YELLOW}⚠ WARNING: RATE_LIMIT_WINDOW_MS not set${NC}" && WARNINGS=$((WARNINGS + 1))
[[ -z "$RATE_LIMIT_MAX_REQUESTS" ]] && echo -e "${YELLOW}⚠ WARNING: RATE_LIMIT_MAX_REQUESTS not set${NC}" && WARNINGS=$((WARNINGS + 1))

# Security checks for production
if [[ "$NODE_ENV" == "production" ]]; then
    echo ""
    echo "🚨 Production Environment Checks:"
    
    if [[ "$LOG_LEVEL" == "debug" ]]; then
        echo -e "${RED}❌ ERROR: LOG_LEVEL should not be 'debug' in production${NC}"
        VALIDATION_FAILED=1
    fi
    
    if [[ "$CORS_ORIGIN" == "*" ]] || [[ "$CORS_ORIGIN" == "http://localhost"* ]]; then
        echo -e "${RED}❌ ERROR: CORS_ORIGIN is not secure for production${NC}"
        VALIDATION_FAILED=1
    fi
fi

# Summary
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

if [[ $VALIDATION_FAILED -eq 0 ]]; then
    if [[ $WARNINGS -eq 0 ]]; then
        echo -e "${GREEN}✅ Environment validation passed successfully!${NC}"
        echo "All required variables are set and properly configured."
    else
        echo -e "${GREEN}✅ Environment validation passed with $WARNINGS warnings${NC}"
        echo "Consider addressing the warnings for better security."
    fi
    exit 0
else
    echo -e "${RED}❌ Environment validation FAILED${NC}"
    echo "Please fix the errors above before running the application."
    echo ""
    echo "To generate secure secrets, use:"
    echo "  openssl rand -base64 32"
    exit 1
fi
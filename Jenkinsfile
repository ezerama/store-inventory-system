pipeline {
    agent any

    environment {
        COMPOSE_PROJECT_NAME = 'store-inventory'
        TAG = "${env.BUILD_NUMBER}"
    }

    options {
        disableConcurrentBuilds()
        buildDiscarder(logRotator(numToKeepStr: '20'))
    }

    stages {
        stage('Checkout') {
            steps {
                checkout scm
            }
        }

        stage('Validate Configuration') {
            steps {
                sh 'test -f .env.example'
                sh 'test -f docker-compose.yml'
                sh 'test -f Jenkinsfile'
            }
        }

        stage('Install Dependencies') {
            steps {
                sh 'npm install --prefix inventory-api'
                sh 'npm install --prefix orders-api'
                sh 'npm install --prefix frontend'
            }
        }

        stage('Run Automated Tests') {
            steps {
                sh 'npm test --prefix inventory-api -- --runInBand'
                sh 'npm test --prefix orders-api -- --runInBand'
            }
        }

        stage('Build Application Images') {
            steps {
                sh 'TAG=$TAG docker compose build --no-cache'
            }
        }

        stage('Deploy Selected Version') {
            steps {
                withCredentials([file(credentialsId: 'store-inventory-env', variable: 'ENV_FILE')]) {
                    sh 'cp "$ENV_FILE" .env'
                    sh 'TAG=$TAG docker compose up -d --no-build --remove-orphans'
                }
            }
        }

        stage('Wait for Healthy Services') {
            steps {
                sh '''
                    for i in $(seq 1 30); do
                        if curl -fsS http://localhost:8080/ >/dev/null && \
                           curl -fsS http://localhost:8080/api/inventory >/dev/null && \
                           curl -fsS http://localhost:8080/api/orders >/dev/null; then
                            echo "Application is healthy";
                            exit 0;
                        fi
                        echo "Waiting for services ($i/30)...";
                        sleep 5;
                    done
                    echo "Application did not become healthy in time";
                    exit 1;
                '''
            }
        }

        stage('Smoke Test') {
            steps {
                sh '''
                    curl -fsS http://localhost:8080/ | grep -qi "Store Inventory"
                    curl -fsS http://localhost:8080/api/inventory | grep -q 'sku'
                    curl -fsS http://localhost:8080/api/orders | grep -q 'items'
                '''
            }
        }

        stage('Publish Reports') {
            steps {
                echo "Deployment version: ${TAG}"
                echo "Application URL: http://localhost:8080"
            }
        }
    }

    post {
        success {
            echo "Build ${TAG} deployed successfully."
        }
        failure {
            echo "Build ${TAG} failed. Deployment did not proceed past the test gate."
        }
        always {
            sh 'rm -f .env || true'
        }
    }
}

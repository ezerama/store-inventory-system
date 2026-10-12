pipeline {
  agent any

  environment {
    COMPOSE_PROJECT_NAME = 'store-inventory-system-collab'
    APP_VERSION = "${env.BUILD_NUMBER}"
    POSTGRES_DB = 'store_inventory'
    POSTGRES_USER = 'store_user'
    POSTGRES_PASSWORD = 'StorePass2026Secure'
    POSTGRES_PORT = '5432'
    DB_HOST = 'postgres'
    DB_NAME = 'store_inventory'
    DB_USER = 'store_user'
    DB_PASSWORD = 'StorePass2026Secure'
  }

  triggers {
    pollSCM('H/2 * * * *')
  }

  stages {
    stage('Checkout') {
      steps {
        checkout scm
      }
    }

    stage('Test') {
      steps {
        script {
          try {
            sh 'docker compose up -d postgres'
            sh 'docker compose build inventory-api orders-api frontend'
            sh 'docker compose run --rm inventory-api npm test'
            sh 'docker compose run --rm orders-api npm test'
          } catch (Exception e) {
            echo "Tests failed: ${e.message}"
            throw e
          }
        }
      }
    }

    stage('Build Images') {
      steps {
        sh 'APP_VERSION=${BUILD_NUMBER} docker compose build --pull'
      }
    }

    stage('Deploy') {
      steps {
        sh 'APP_VERSION=${BUILD_NUMBER} docker compose up -d --no-build'
      }
    }

    stage('Smoke Test') {
      steps {
        script {
          try {
            sh 'docker compose exec -T proxy curl -fsS http://localhost/health'
            sh 'docker compose exec -T proxy curl -fsS http://localhost/api/items'
            sh 'docker compose exec -T proxy curl -fsS http://localhost/api/orders'
            echo "All endpoints are healthy!"
          } catch (Exception e) {
            echo "Smoke test failed: ${e.message}"
            throw e
          }
        }
      }
    }
  }

  post {
    always {
      echo "Build finished with result: ${currentBuild.currentResult}"
      echo "Application version deployed: ${APP_VERSION}"
    }
    success {
      echo 'Deployment succeeded. App is live.'
    }
    failure {
      echo 'Deployment failed. No new version was deployed to production.'
    }
  }
}



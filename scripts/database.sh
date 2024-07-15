#!/bin/bash
echo "Creating models..."
npx sequelize-cli db:migrate
echo "Seeding database..."
npx sequelize-cli db:seed:all
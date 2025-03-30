const { Sequelize, DataTypes } = require('sequelize');
const path = require('path');
const fs = require('fs');
const log = console; // Replace with your logging mechanism

const Database = {
    sqlitePath: path.resolve(__dirname, './database/db.sqlite')
};

// Ensure the SQLite database file exists
if (!fs.existsSync(Database.sqlitePath)) {
    log.info("server", "Creating Database");
    fs.writeFileSync(Database.sqlitePath, '');
}

// Initialize Sequelize
const sequelize = new Sequelize({
    dialect: 'sqlite',
    storage: Database.sqlitePath,
    logging: msg => log.info("db", msg) // Optional: log SQL queries
    // logging: false
});


const Monitor = sequelize.define('Monitor', {
    id: {
        type: DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true
    },
    name: {
        type: DataTypes.STRING(150),
        allowNull: true
    },
    type: {
        type: DataTypes.STRING(20),
        allowNull: true
    },
    url: {
        type: DataTypes.TEXT,
        allowNull: true
    },
    interval: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 20
    },
    timeout: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 16
    },
    maxretries: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0
    },
    method: {
        type: DataTypes.TEXT,
        allowNull: false,
        defaultValue: 'GET'
    },
    accepted_statuscodes_json: {
        type: DataTypes.TEXT,
        allowNull: false,
        defaultValue: '["200-299"]'
    },
    httpBodyEncoding: {
        type: DataTypes.TEXT,
        allowNull: false,
        defaultValue: 'json'
    },
    body: {
        type: DataTypes.TEXT,
        allowNull: true
    },
    headers: {
        type: DataTypes.TEXT,
        allowNull: true
    },
    active: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: true
    },
    created_date: {
        type: DataTypes.DATE,
        allowNull: true,
        defaultValue: DataTypes.NOW
    },
}, {
    tableName: 'monitor',
    timestamps: false // Since there's no explicit `updated_at` and `created_at` columns
});

const Heartbeat = sequelize.define('Heartbeat', {
    id: {
        type: DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true
    },
    important: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false
    },
    monitor_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
            model: 'monitor', // Ensure this matches your actual Monitor model table name
            key: 'id'
        },
        onDelete: 'CASCADE',
        onUpdate: 'CASCADE'
    },
    status: {
        type: DataTypes.SMALLINT,
        allowNull: false
    },
    msg: {
        type: DataTypes.TEXT,
        allowNull: true
    },
    time: {
        type: DataTypes.DATE,
        allowNull: false
    },
    ping: {
        type: DataTypes.INTEGER,
        allowNull: true
    },
    duration: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0
    },
    down_count: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0
    }
}, {
    tableName: 'heartbeat',
    timestamps: false // Since there's no explicit `created_at` and `updated_at` columns
});

const Notification = sequelize.define('Notification', {
    id: {
        type: DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true
    },
    name: {
        type: DataTypes.STRING(255),
        allowNull: true
    },
    description: {
        type: DataTypes.STRING(255),
        allowNull: true
    },
    active: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: true
    },
    email: {
        type: DataTypes.STRING(255),
        allowNull: false
    }
}, {
    tableName: 'notification',
    timestamps: false // Since there's no explicit `created_at` and `updated_at` columns
});

const MonitorTlsInfo = sequelize.define('MonitorTlsInfo', {
    id: {
        type: DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true
    },
    monitor_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
            model: 'monitor', // Ensure this matches your actual Monitor model table name
            key: 'id'
        },
        onDelete: 'CASCADE',
        onUpdate: 'CASCADE'
    },
    info_json: {
        type: DataTypes.TEXT,
        allowNull: true
    }
}, {
    tableName: 'monitor_tls_info',
    timestamps: false // Since there's no explicit `created_at` and `updated_at` columns
});
const ErrorTable = sequelize.define('Error', {
    id: {
        type: DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true
    },
    table_name: {
        type: DataTypes.TEXT,
        allowNull: false,
    },
    err_text: {
        type: DataTypes.TEXT,
        allowNull: false
    }
}, {
    tableName: 'error',
    timestamps: false // Since there's no explicit `created_at` and `updated_at` columns
});

// Sync models with the database
sequelize.sync()
    .then(() => {
        log.info("db", "Database & tables created!");
    })
    .catch(err => {
        log.error("db", "Error creating database & tables:", err);
    });

module.exports = {
    sequelize,
    Monitor,
    Heartbeat,
    Notification,
    MonitorTlsInfo, ErrorTable
};
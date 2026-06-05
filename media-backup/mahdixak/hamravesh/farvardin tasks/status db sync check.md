## database in c12: 

    Client
  	└─> HAProxy
        	└─> PgBouncer (connection pooling)
              		└─> Stolon Proxy (finds current primary)
                    		└─> Stolon Keeper (runs actual Postgres)
                     		↕ replication
	                    	        └─> Stolon Keeper (standby)

	Stolon Sentinel ──── monitors keepers & triggers failover


## database in c15: 

	Client (backend pod)
		└─> postgres-0 (primary Postgres)

	Patroni ──── monitors postgres-0\
		└─> reads/writes state to etcd\
		           └─> triggers failover if needed


d8020f74-36a4-4d2c-8d88-b6efbd833051.hsvc.ir:32055 -- etcd3 

External 3-node etcd cluster (hsvc.ir endpoints)\
  ├── node1: 71dd5e51...  port 30956  ✅ reachable\
  ├── node2: 41443614...  port 30170  ❌ DNS dead\
  └── node3: d8020f74...  port 31264  ✅ reachable

Patroni cluster "demo"\
  ├── patroni1  185.53.140.26:31981   → start failed ❌\
  └── patroni2  157.119.191.243:30124 → not registered? ⚠️\
        └── postgres-0 (local postgres instance)\
              PGDATA=/home/postgres/data\
              Postgres 15
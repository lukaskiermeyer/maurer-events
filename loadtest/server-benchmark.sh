#!/usr/bin/env bash
# Server-Benchmark (auf dem ZIELserver ausführen, NICHT während Lasttest).
# Ergebnisse als JSON in loadtest/bench-results/.

set -euo pipefail
OUT="${OUT:-loadtest/bench-results}"
mkdir -p "$OUT"
TS=$(date +%Y%m%dT%H%M%S)

# 1) CPU single-thread
sysbench cpu --cpu-max-prime=20000 --threads=1 run | tee "$OUT/sysbench-cpu-1-$TS.txt"

# 2) CPU multi-thread (Anzahl vCPUs)
NPROC=$(nproc)
sysbench cpu --cpu-max-prime=20000 --threads="$NPROC" run | tee "$OUT/sysbench-cpu-${NPROC}-$TS.txt"

# 3) Memory
sysbench memory --memory-block-size=1K --memory-total-size=10G --memory-oper=write run | tee "$OUT/sysbench-mem-$TS.txt"

# 4) fio fsync-Latenz (Datenverzeichnis der DB / App)
fio --name=fsync-latency --directory=/var/lib/postgresql/data --rw=randwrite --bs=4k \
    --size=1G --numjobs=1 --iodepth=1 --fsync=1 --runtime=60 --time_based \
    --group_reporting --output-format=json --output="$OUT/fio-fsync-$TS.json"

# 5) Steal-Time Mitschnitt (60s)
mpstat -P ALL 1 60 | tee "$OUT/mpstat-$TS.txt"

# 6) RAM/CPU Peak während Lasttest (parallel laufen lassen)
# watch -n1 'docker stats --no-stream --format "{{.Name}} {{.CPUPerc}} {{.MemUsage}}"' | tee "$OUT/dockerstats-$TS.txt"

echo "Ergebnisse in $OUT"

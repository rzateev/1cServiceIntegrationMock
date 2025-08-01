# Licensed to the Apache Software Foundation (ASF) under one
# or more contributor license agreements.  See the NOTICE file
# distributed with this work for additional information
# regarding copyright ownership.  The ASF licenses this file
# to you under the Apache License, Version 2.0 (the
# "License"); you may not use this file except in compliance
# with the License.  You may obtain a copy of the License at
#
#   http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing,
# software distributed under the License is distributed on an
# "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
# KIND, either express or implied.  See the License for the
# specific language governing permissions and limitations
# under the License.

ARTEMIS_HOME='/opt/apache-artemis-2.16.0'
ARTEMIS_INSTANCE='/var/lib/artemis'
ARTEMIS_DATA_DIR='/var/lib/artemis/data'
ARTEMIS_ETC_DIR='/var/lib/artemis/etc'
ARTEMIS_OOME_DUMP='/var/lib/artemis/log/oom_dump.hprof'

# The logging config will need an URI
# this will be encoded in case you use spaces or special characters
# on your directory structure
ARTEMIS_INSTANCE_URI='file:/var/lib/artemis/'
ARTEMIS_INSTANCE_ETC_URI='file:/var/lib/artemis/etc/'

# Cluster Properties: Used to pass arguments to ActiveMQ Artemis which can be referenced in broker.xml
#ARTEMIS_CLUSTER_PROPS="-Dactivemq.remoting.default.port=61617 -Dactivemq.remoting.amqp.port=5673 -Dactivemq.remoting.stomp.port=61614 -Dactivemq.remoting.hornetq.port=5446"


# Hawtio Properties
HAWTIO_ROLE='amq'


# Java Opts
if [ -z "$JAVA_ARGS" ]; then
 JAVA_ARGS="$BROKER_CONFIGS -Djava.net.preferIPv4Addresses=true -Djava.net.preferIPv4Stack=true -XX:+UnlockExperimentalVMOptions -XX:+UseCGroupMemoryLimitForHeap -XX:MaxRAMFraction=2  -XX:+PrintClassHistogram -XX:+UseG1GC -XX:+UseStringDeduplication   -Dhawtio.disableProxy=true -Dhawtio.realm=activemq -Dhawtio.offline=true -Dhawtio.rolePrincipalClasses=org.apache.activemq.artemis.spi.core.security.jaas.RolePrincipal -Djolokia.policyLocation=${ARTEMIS_INSTANCE_ETC_URI}jolokia-access.xml"
fi

#
# Logs Safepoints JVM pauses: Uncomment to enable them
# In addition to the traditional GC logs you could enable some JVM flags to know any meaningful and "hidden" pause that could
# affect the latencies of the services delivered by the broker, including those that are not reported by the classic GC logs
# and dependent by JVM background work (eg method deoptimizations, lock unbiasing, JNI, counted loops and obviously GC activity).
# Replace "all_pauses.log" with the file name you want to log to.
# JAVA_ARGS="-Djava.net.preferIPv4Addresses=true -Djava.net.preferIPv4Stack=true -XX:+UnlockExperimentalVMOptions -XX:+UseCGroupMemoryLimitForHeap -XX:MaxRAMFraction=2 $JAVA_ARGS -XX:+PrintSafepointStatistics -XX:PrintSafepointStatisticsCount=1 -XX:+PrintGCApplicationStoppedTime -XX:+PrintGCApplicationConcurrentTime -XX:+LogVMOutput -XX:LogFile=all_pauses.log"

#
# Enables the dumping of the java heap when a java.lang.OutOfMemoryError exception is thrown.
# JAVA_ARGS="-Djava.net.preferIPv4Addresses=true -Djava.net.preferIPv4Stack=true -XX:+UnlockExperimentalVMOptions -XX:+UseCGroupMemoryLimitForHeap -XX:MaxRAMFraction=2 $JAVA_ARGS -XX:+HeapDumpOnOutOfMemoryError -XX:HeapDumpPath=${ARTEMIS_OOME_DUMP}"

# Debug args: Uncomment to enable debug
#DEBUG_ARGS="-agentlib:jdwp=transport=dt_socket,server=y,suspend=y,address=5005"

# Debug args: Uncomment for async profiler
#DEBUG_ARGS="-XX:+UnlockDiagnosticVMOptions -XX:+DebugNonSafepoints"

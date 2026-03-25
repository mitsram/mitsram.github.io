# MuleSoft Platform — Architecture & Testing Guide

## Table of Contents

1. [MuleSoft Architecture Overview](#mulesoft-architecture-overview)
2. [Testing Strategy](#testing-strategy)
3. [Unit Testing](#unit-testing)
4. [Integration Testing](#integration-testing)
5. [System Integration Testing (SIT)](#system-integration-testing-sit)
6. [Recommended Frameworks & Tools](#recommended-frameworks--tools)
7. [Test Pyramid & Coverage Guidance](#test-pyramid--coverage-guidance)
8. [CI/CD Integration](#cicd-integration)

---

## 1. MuleSoft Architecture Overview

### High-Level Platform Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                        Anypoint Platform                            │
├──────────────┬──────────────┬──────────────┬───────────────────────┤
│  API Manager │  Exchange    │  Runtime Mgr │  Visualizer / Monitor │
├──────────────┴──────────────┴──────────────┴───────────────────────┤
│                         Anypoint Studio (IDE)                       │
├─────────────────────────────────────────────────────────────────────┤
│                       Mule Runtime Engine (4.x)                     │
├──────────────┬──────────────┬──────────────┬───────────────────────┤
│  Connectors  │  DataWeave   │  Policies    │  API Gateway           │
├──────────────┴──────────────┴──────────────┴───────────────────────┤
│           CloudHub / Runtime Fabric / On-Prem Deployment            │
└─────────────────────────────────────────────────────────────────────┘
```

### Core Components

| Component | Description |
|---|---|
| **Mule Runtime Engine** | Lightweight, Java-based ESB that processes messages through flows. Flows are the fundamental unit of work. |
| **Anypoint Studio** | Eclipse-based IDE for building Mule applications. Provides visual drag-and-drop and XML/DataWeave editors. |
| **DataWeave 2.0** | MuleSoft's transformation language for mapping and transforming data between formats (JSON, XML, CSV, etc.). |
| **Connectors** | Pre-built adapters for SaaS, databases, protocols (HTTP, JMS, SFTP, Salesforce, SAP, etc.). |
| **API Manager** | Manages API lifecycle — policies, SLAs, rate limiting, security, analytics. |
| **Exchange** | Repository for reusable assets — APIs, connectors, templates, examples. |
| **CloudHub** | MuleSoft's iPaaS for deploying Mule apps to the cloud. |
| **Runtime Fabric** | Container-based deployment option (Kubernetes) for hybrid/on-prem. |
| **Object Store** | Persistent key-value store for stateful processing. |
| **API Gateway** | Enforces policies and manages traffic at the edge (embedded or standalone). |

### Mule Application Structure

```
my-mule-app/
├── src/
│   ├── main/
│   │   ├── mule/                    # Mule XML configuration files (flows)
│   │   │   ├── my-app.xml           # Main flow
│   │   │   ├── global-config.xml    # Global connectors, error handling
│   │   │   └── sub-flows.xml        # Reusable sub-flows
│   │   ├── resources/
│   │   │   ├── application.yaml     # App properties
│   │   │   ├── dwl/                 # DataWeave transformation files
│   │   │   └── api/                 # RAML/OAS API specs
│   │   └── java/                    # Custom Java classes
│   └── test/
│       ├── munit/                   # MUnit test XML files
│       ├── resources/               # Test fixtures, mock payloads
│       └── java/                    # Java-based test classes
├── pom.xml                          # Maven build descriptor
└── mule-artifact.json               # Mule packaging metadata
```

### Typical Mule Flow Architecture

```
[HTTP Listener] → [API Router] → [Transform (DataWeave)]
       │                                    │
       ▼                                    ▼
  [Validation]                    [Business Logic Flow]
                                        │
                            ┌───────────┼───────────┐
                            ▼           ▼           ▼
                      [DB Connector] [REST API]  [JMS Queue]
                            │           │           │
                            └───────────┼───────────┘
                                        ▼
                               [Response Transform]
                                        │
                                        ▼
                               [HTTP Response]
```

### API-Led Connectivity (Three-Tier Architecture)

MuleSoft advocates a three-layer API architecture:

```
┌─────────────────────────────────────────┐
│           Experience APIs               │  ← Mobile, Web, Partner portals
│   (Channel-specific orchestration)      │
├─────────────────────────────────────────┤
│            Process APIs                 │  ← Business logic, orchestration
│   (Compose data from multiple sources)  │
├─────────────────────────────────────────┤
│            System APIs                  │  ← Direct system connectivity
│   (Wrap backend systems: SAP, DB, CRM)  │
└─────────────────────────────────────────┘
```

| Layer | Purpose | Example |
|---|---|---|
| **System API** | Unlocks data from core systems with a standardised interface | `sys-salesforce-api`, `sys-oracle-db-api` |
| **Process API** | Orchestrates calls across multiple System APIs, applies business rules | `proc-order-fulfillment-api` |
| **Experience API** | Shapes data for a specific consumer channel | `exp-mobile-orders-api` |

---

## 2. Testing Strategy

### Testing Pyramid for MuleSoft

```
            ╱  SIT  ╲                 ← Fewer, slower, high-confidence
           ╱─────────╲
          ╱ Integration╲              ← Moderate count, validate wiring
         ╱─────────────╲
        ╱   Unit Tests   ╲           ← Many, fast, isolated
       ╱───────────────────╲
```

| Level | Scope | Speed | Dependencies |
|---|---|---|---|
| **Unit** | Single flow, sub-flow, or DataWeave transform | Fast (seconds) | All mocked |
| **Integration** | Flow-to-flow, connector-to-system, end-to-end within the app | Medium (seconds–minutes) | Partial mocks, embedded test containers |
| **SIT** | Cross-application, cross-API, end-to-end across environments | Slow (minutes) | Real or sandboxed external systems |

---

## 3. Unit Testing

### What to Unit Test

- Individual Mule flows and sub-flows
- DataWeave transformations (mapping correctness, edge cases, null handling)
- Custom Java components invoked from Mule flows
- Choice routers and conditional logic
- Error handling and exception strategies
- Validators and input filtering

### Framework: MUnit 2.x (Primary)

**MUnit** is MuleSoft's native testing framework, bundled with Anypoint Studio and Maven. It runs on top of the Mule Runtime and is purpose-built for testing Mule flows.

#### MUnit XML Test Example

```xml
<munit:test name="test-transform-order-payload"
            description="Verify DataWeave maps order fields correctly">

    <!-- Arrange: Set the input payload -->
    <munit:behavior>
        <munit-tools:mock-when processor="http:request"
                     doc:name="Mock External API Call">
            <munit-tools:with-attributes>
                <munit-tools:with-attribute
                    attributeName="config-ref"
                    whereValue="HTTP_Request_Configuration"/>
            </munit-tools:with-attributes>
            <munit-tools:then-return>
                <munit-tools:payload
                    value='#[readUrl("classpath://test-data/mock-order-response.json","application/json")]'/>
            </munit-tools:then-return>
        </munit-tools:mock-when>

        <munit:set-event doc:name="Set test payload">
            <munit:payload
                value='#[readUrl("classpath://test-data/input-order.json","application/json")]'/>
        </munit:set-event>
    </munit:behavior>

    <!-- Act: Execute the flow under test -->
    <munit:execution>
        <flow-ref name="process-order-sub-flow" doc:name="Run flow"/>
    </munit:execution>

    <!-- Assert: Validate output -->
    <munit:validation>
        <munit-tools:assert-that
            expression="#[payload.orderId]"
            is="#[MunitTools::notNullValue()]"
            message="Order ID must not be null"/>
        <munit-tools:assert-that
            expression="#[payload.status]"
            is="#[MunitTools::equalTo('CONFIRMED')]"
            message="Status should be CONFIRMED"/>
    </munit:validation>
</munit:test>
```

#### Running MUnit via Maven

```bash
mvn clean test -Dmunit.test=test-transform-order-payload
mvn clean test                          # Run all MUnit tests
mvn clean test -Dmunit.coverage.failBuild=true -Dmunit.coverage.minCoverage=80
```

### Unit Testing DataWeave with Java (JUnit 5 + DataWeave Testing Framework)

For isolated DataWeave testing without spinning up the Mule Runtime:

#### Maven Dependencies

```xml
<dependency>
    <groupId>org.mule.weave</groupId>
    <artifactId>runtime</artifactId>
    <version>${dataweave.version}</version>
    <scope>test</scope>
</dependency>
<dependency>
    <groupId>org.mule.weave</groupId>
    <artifactId>data-weave-testing-framework</artifactId>
    <version>${dataweave.version}</version>
    <scope>test</scope>
</dependency>
```

#### Java Test Class

```java
package com.example.transforms;

import org.junit.jupiter.api.Test;
import org.mule.weave.v2.el.WeaveExpressionLanguage;
import static org.junit.jupiter.api.Assertions.*;

class OrderTransformTest {

    @Test
    void shouldMapOrderFieldsCorrectly() {
        String input = """
            {
              "order_id": "ORD-001",
              "customer_name": "Jane Doe",
              "total_amount": 150.00
            }
            """;

        String expectedOutput = """
            {
              "orderId": "ORD-001",
              "customer": "Jane Doe",
              "amount": 150.00,
              "currency": "AUD"
            }
            """;

        // Load and run the DataWeave script from src/main/resources/dwl/
        String result = DataWeaveTestUtils.transform(
            "dwl/map-order.dwl", input, "application/json"
        );

        assertNotNull(result);
        assertTrue(result.contains("\"orderId\": \"ORD-001\""));
    }
}
```

### Unit Testing Custom Java Components (JUnit 5 + Mockito)

Custom Java classes invoked via `<java:invoke>` or `<java:new>` in Mule can be unit tested with standard JUnit:

```java
package com.example.components;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class OrderValidatorTest {

    @Mock
    private ReferenceDataService referenceDataService;

    @InjectMocks
    private OrderValidator validator;

    @Test
    void shouldRejectOrderWithNegativeAmount() {
        Order order = new Order("ORD-001", "Jane Doe", -50.00);

        ValidationResult result = validator.validate(order);

        assertFalse(result.isValid());
        assertEquals("Amount must be positive", result.getErrorMessage());
    }

    @Test
    void shouldAcceptValidOrder() {
        Order order = new Order("ORD-002", "John Smith", 200.00);
        when(referenceDataService.isValidCustomer("John Smith")).thenReturn(true);

        ValidationResult result = validator.validate(order);

        assertTrue(result.isValid());
        verify(referenceDataService).isValidCustomer("John Smith");
    }
}
```

---

## 4. Integration Testing

### What to Integration Test

- End-to-end flow execution within a single Mule application
- Connector interactions with real or containerised backends (DB, JMS, SFTP)
- Error propagation across chained flows
- API routing and policy enforcement
- Object Store read/write behaviour
- Batch job processing

### Framework: MUnit 2.x + Testcontainers

Use MUnit for flow-level integration tests, combined with **Testcontainers** for spinning up real dependencies in Docker.

#### Maven Dependencies

```xml
<!-- MUnit (included with Mule Maven Plugin) -->
<dependency>
    <groupId>com.mulesoft.munit</groupId>
    <artifactId>munit-runner</artifactId>
    <version>${munit.version}</version>
    <classifier>mule-plugin</classifier>
    <scope>test</scope>
</dependency>
<dependency>
    <groupId>com.mulesoft.munit</groupId>
    <artifactId>munit-tools</artifactId>
    <version>${munit.version}</version>
    <classifier>mule-plugin</classifier>
    <scope>test</scope>
</dependency>

<!-- Testcontainers for real DB/queue in Docker -->
<dependency>
    <groupId>org.testcontainers</groupId>
    <artifactId>testcontainers</artifactId>
    <version>${testcontainers.version}</version>
    <scope>test</scope>
</dependency>
<dependency>
    <groupId>org.testcontainers</groupId>
    <artifactId>postgresql</artifactId>
    <version>${testcontainers.version}</version>
    <scope>test</scope>
</dependency>
```

#### Integration Test — Database Connector (Java + Testcontainers + JUnit 5)

```java
package com.example.integration;

import org.junit.jupiter.api.*;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;

import java.sql.*;

import static org.junit.jupiter.api.Assertions.*;

@Testcontainers
class OrderDatabaseIntegrationTest {

    @Container
    static PostgreSQLContainer<?> postgres = new PostgreSQLContainer<>("postgres:15-alpine")
        .withDatabaseName("orders_db")
        .withUsername("test")
        .withPassword("test")
        .withInitScript("sql/init-orders.sql");

    @Test
    void shouldPersistOrderToDatabase() throws Exception {
        // Use postgres.getJdbcUrl() to configure Mule DB connector properties
        String jdbcUrl = postgres.getJdbcUrl();

        try (Connection conn = DriverManager.getConnection(
                jdbcUrl, postgres.getUsername(), postgres.getPassword())) {

            // Simulate what the Mule flow does
            PreparedStatement ps = conn.prepareStatement(
                "INSERT INTO orders (order_id, customer, amount) VALUES (?, ?, ?)"
            );
            ps.setString(1, "ORD-100");
            ps.setString(2, "Test Customer");
            ps.setBigDecimal(3, new java.math.BigDecimal("250.00"));
            ps.executeUpdate();

            // Verify
            ResultSet rs = conn.createStatement()
                .executeQuery("SELECT * FROM orders WHERE order_id = 'ORD-100'");
            assertTrue(rs.next());
            assertEquals("Test Customer", rs.getString("customer"));
        }
    }
}
```

#### MUnit Integration Test — Full Flow with Partial Mocks

```xml
<munit:test name="integration-test-order-creation-flow"
            description="Test full order creation with DB write, mocking external API">

    <munit:behavior>
        <!-- Mock only the external HTTP call, let DB connector run against real DB -->
        <munit-tools:mock-when processor="http:request"
                     doc:name="Mock inventory check API">
            <munit-tools:with-attributes>
                <munit-tools:with-attribute
                    attributeName="doc:name"
                    whereValue="Check Inventory"/>
            </munit-tools:with-attributes>
            <munit-tools:then-return>
                <munit-tools:payload
                    value='#[{"available": true, "quantity": 50}]'
                    mediaType="application/json"/>
            </munit-tools:then-return>
        </munit-tools:mock-when>

        <munit:set-event doc:name="Set order request">
            <munit:payload
                value='#[readUrl("classpath://test-data/new-order-request.json","application/json")]'/>
            <munit:attributes
                value='#[{method: "POST", requestUri: "/api/v1/orders"}]'/>
        </munit:set-event>
    </munit:behavior>

    <munit:execution>
        <flow-ref name="post-order-main-flow" doc:name="Execute main flow"/>
    </munit:execution>

    <munit:validation>
        <munit-tools:assert-that
            expression="#[payload.status]"
            is="#[MunitTools::equalTo('CREATED')]"/>
        <munit-tools:assert-that
            expression="#[payload.orderId]"
            is="#[MunitTools::notNullValue()]"/>

        <!-- Verify DB side effect -->
        <db:select config-ref="Test_Database_Config" doc:name="Verify DB record">
            <db:sql>SELECT * FROM orders WHERE order_id = '#[payload.orderId]'</db:sql>
        </db:select>
        <munit-tools:assert-that
            expression="#[sizeOf(payload)]"
            is="#[MunitTools::equalTo(1)]"
            message="Order should exist in database"/>
    </munit:validation>
</munit:test>
```

#### Integration Test — JMS / ActiveMQ (Testcontainers)

```java
package com.example.integration;

import org.apache.activemq.ActiveMQConnectionFactory;
import org.junit.jupiter.api.*;
import org.testcontainers.containers.GenericContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;
import org.testcontainers.utility.DockerImageName;

import javax.jms.*;

import static org.junit.jupiter.api.Assertions.*;

@Testcontainers
class OrderQueueIntegrationTest {

    @Container
    static GenericContainer<?> activemq = new GenericContainer<>(
            DockerImageName.parse("rmohr/activemq:5.16.3"))
        .withExposedPorts(61616);

    @Test
    void shouldPublishOrderEventToQueue() throws Exception {
        String brokerUrl = "tcp://" + activemq.getHost() + ":"
                         + activemq.getMappedPort(61616);

        ActiveMQConnectionFactory factory = new ActiveMQConnectionFactory(brokerUrl);
        try (Connection conn = factory.createConnection()) {
            conn.start();
            Session session = conn.createSession(false, Session.AUTO_ACKNOWLEDGE);
            Queue queue = session.createQueue("order.events");

            // Produce (simulating what the Mule flow does)
            MessageProducer producer = session.createProducer(queue);
            TextMessage msg = session.createTextMessage(
                "{\"orderId\":\"ORD-200\",\"event\":\"CREATED\"}"
            );
            producer.send(msg);

            // Consume and verify
            MessageConsumer consumer = session.createConsumer(queue);
            TextMessage received = (TextMessage) consumer.receive(5000);
            assertNotNull(received);
            assertTrue(received.getText().contains("ORD-200"));
        }
    }
}
```

---

## 5. System Integration Testing (SIT)

### What to System Integration Test

- End-to-end API flows across **multiple Mule applications** (Experience → Process → System APIs)
- Cross-system data consistency (e.g., order created in API → verify in Salesforce + DB)
- API policy enforcement (OAuth 2.0, rate limiting, IP whitelisting)
- Error scenarios with real downstream failures (timeouts, 5xx responses)
- Batch processing with real data volumes
- Deployment smoke tests on staging / pre-production environments

### Framework: REST Assured + JUnit 5 (Primary) + WireMock for controlled stubs

#### Maven Dependencies

```xml
<dependency>
    <groupId>io.rest-assured</groupId>
    <artifactId>rest-assured</artifactId>
    <version>${rest-assured.version}</version>
    <scope>test</scope>
</dependency>
<dependency>
    <groupId>io.rest-assured</groupId>
    <artifactId>json-path</artifactId>
    <version>${rest-assured.version}</version>
    <scope>test</scope>
</dependency>
<dependency>
    <groupId>io.rest-assured</groupId>
    <artifactId>json-schema-validator</artifactId>
    <version>${rest-assured.version}</version>
    <scope>test</scope>
</dependency>
<dependency>
    <groupId>org.wiremock</groupId>
    <artifactId>wiremock-standalone</artifactId>
    <version>${wiremock.version}</version>
    <scope>test</scope>
</dependency>
<dependency>
    <groupId>org.awaitility</groupId>
    <artifactId>awaitility</artifactId>
    <version>${awaitility.version}</version>
    <scope>test</scope>
</dependency>
```

#### SIT — Full API Chain (REST Assured + JUnit 5)

```java
package com.example.sit;

import io.restassured.RestAssured;
import io.restassured.http.ContentType;
import org.junit.jupiter.api.*;

import static io.restassured.RestAssured.*;
import static org.hamcrest.Matchers.*;

@TestMethodOrder(MethodOrderer.OrderAnnotation.class)
class OrderApiSystemIntegrationTest {

    private static String createdOrderId;

    @BeforeAll
    static void setup() {
        RestAssured.baseURI = System.getProperty("sit.base.url",
            "https://staging.example.com/api/v1");
        RestAssured.authentication = oauth2(System.getProperty("sit.access.token"));
    }

    @Test
    @Order(1)
    void shouldCreateOrder() {
        String requestBody = """
            {
              "customer": "SIT Test Customer",
              "items": [
                {"sku": "ITEM-001", "quantity": 2, "unitPrice": 49.99}
              ],
              "shippingAddress": {
                "street": "123 Test St",
                "city": "Sydney",
                "postcode": "2000"
              }
            }
            """;

        createdOrderId =
            given()
                .contentType(ContentType.JSON)
                .body(requestBody)
            .when()
                .post("/orders")
            .then()
                .statusCode(201)
                .body("status", equalTo("CREATED"))
                .body("orderId", notNullValue())
                .body("items", hasSize(1))
                .body("totalAmount", equalTo(99.98f))
                .extract()
                .path("orderId");
    }

    @Test
    @Order(2)
    void shouldRetrieveCreatedOrder() {
        given()
            .pathParam("orderId", createdOrderId)
        .when()
            .get("/orders/{orderId}")
        .then()
            .statusCode(200)
            .body("orderId", equalTo(createdOrderId))
            .body("status", equalTo("CREATED"))
            .body("customer", equalTo("SIT Test Customer"));
    }

    @Test
    @Order(3)
    void shouldReturn404ForNonExistentOrder() {
        given()
        .when()
            .get("/orders/NON-EXISTENT-ID")
        .then()
            .statusCode(404)
            .body("message", containsString("not found"));
    }

    @Test
    @Order(4)
    void shouldReturn400ForInvalidPayload() {
        given()
            .contentType(ContentType.JSON)
            .body("{}")
        .when()
            .post("/orders")
        .then()
            .statusCode(400)
            .body("errors", not(empty()));
    }

    @Test
    @Order(5)
    void shouldEnforceRateLimiting() {
        // Rapid-fire requests to test API Manager rate-limiting policy
        for (int i = 0; i < 100; i++) {
            given()
            .when()
                .get("/orders/" + createdOrderId);
        }

        // The next request should be throttled
        given()
        .when()
            .get("/orders/" + createdOrderId)
        .then()
            .statusCode(anyOf(is(200), is(429)));
    }
}
```

#### SIT — Cross-System Verification (Async Processing)

```java
package com.example.sit;

import io.restassured.RestAssured;
import org.awaitility.Awaitility;
import org.junit.jupiter.api.*;

import java.time.Duration;

import static io.restassured.RestAssured.*;
import static org.hamcrest.Matchers.*;

class AsyncOrderProcessingSitTest {

    @Test
    void shouldProcessOrderAndUpdateDownstreamSystems() {
        // 1. Submit order via Experience API
        String orderId =
            given()
                .contentType("application/json")
                .body(loadTestData("sit/async-order-request.json"))
            .when()
                .post(experienceApiUrl("/orders"))
            .then()
                .statusCode(202)   // Accepted for async processing
                .extract().path("orderId");

        // 2. Poll Process API until order is FULFILLED (with timeout)
        Awaitility.await()
            .atMost(Duration.ofSeconds(60))
            .pollInterval(Duration.ofSeconds(5))
            .untilAsserted(() ->
                given()
                .when()
                    .get(processApiUrl("/orders/" + orderId + "/status"))
                .then()
                    .statusCode(200)
                    .body("status", equalTo("FULFILLED"))
            );

        // 3. Verify data landed in the System API (downstream DB)
        given()
        .when()
            .get(systemApiUrl("/inventory/adjustments?orderId=" + orderId))
        .then()
            .statusCode(200)
            .body("adjustments", hasSize(greaterThan(0)))
            .body("adjustments[0].type", equalTo("DECREMENT"));
    }

    private String loadTestData(String path) {
        return new String(getClass().getClassLoader()
            .getResourceAsStream(path).readAllBytes());
    }

    private String experienceApiUrl(String path) {
        return System.getProperty("sit.experience.api.url") + path;
    }
    private String processApiUrl(String path) {
        return System.getProperty("sit.process.api.url") + path;
    }
    private String systemApiUrl(String path) {
        return System.getProperty("sit.system.api.url") + path;
    }
}
```

#### SIT — Contract Testing (JSON Schema Validation)

```java
@Test
void responseShouldMatchApiContract() {
    given()
    .when()
        .get("/orders/" + createdOrderId)
    .then()
        .statusCode(200)
        .body(matchesJsonSchemaInClasspath("schemas/order-response-schema.json"));
}
```

---

## 6. Recommended Frameworks & Tools

### Summary Table

| Tool | Purpose | Test Level | Language |
|---|---|---|---|
| **MUnit 2.x** | Native Mule flow testing (mock processors, assert payloads) | Unit, Integration | XML (Mule DSL) |
| **JUnit 5** | Test runner for Java components and orchestrating test suites | All levels | Java |
| **Mockito** | Mocking Java dependencies | Unit | Java |
| **DataWeave Testing Framework** | Isolated DataWeave transform testing without Mule Runtime | Unit | Java/DataWeave |
| **Testcontainers** | Spin up Docker containers for DB, MQ, SFTP in tests | Integration | Java |
| **REST Assured** | HTTP API testing with fluent assertions | Integration, SIT | Java |
| **WireMock** | HTTP mock server for simulating external APIs | Integration, SIT | Java |
| **Awaitility** | Polling and async assertion library | SIT | Java |
| **Karate DSL** | BDD-style API testing (alternative to REST Assured) | Integration, SIT | Gherkin/Java |
| **Gatling** | Performance and load testing for APIs | SIT / Performance | Scala/Java |
| **Postman / Newman** | Manual and automated API testing via collections | SIT / Smoke | JavaScript |
| **AssertJ** | Fluent assertion library for Java | All levels | Java |
| **JaCoCo** | Code coverage reporting for Java classes | Unit, Integration | Java |
| **MUnit Coverage** | Flow coverage reporting for Mule XML flows | Unit, Integration | XML |

### Recommended pom.xml Snippet

```xml
<properties>
    <munit.version>3.1.0</munit.version>
    <junit.version>5.10.2</junit.version>
    <mockito.version>5.11.0</mockito.version>
    <rest-assured.version>5.4.0</rest-assured.version>
    <testcontainers.version>1.19.7</testcontainers.version>
    <wiremock.version>3.5.4</wiremock.version>
    <awaitility.version>4.2.1</awaitility.version>
    <jacoco.version>0.8.12</jacoco.version>
</properties>

<dependencies>
    <!-- JUnit 5 -->
    <dependency>
        <groupId>org.junit.jupiter</groupId>
        <artifactId>junit-jupiter</artifactId>
        <version>${junit.version}</version>
        <scope>test</scope>
    </dependency>
    <!-- Mockito -->
    <dependency>
        <groupId>org.mockito</groupId>
        <artifactId>mockito-junit-jupiter</artifactId>
        <version>${mockito.version}</version>
        <scope>test</scope>
    </dependency>
    <!-- REST Assured -->
    <dependency>
        <groupId>io.rest-assured</groupId>
        <artifactId>rest-assured</artifactId>
        <version>${rest-assured.version}</version>
        <scope>test</scope>
    </dependency>
    <!-- Testcontainers -->
    <dependency>
        <groupId>org.testcontainers</groupId>
        <artifactId>junit-jupiter</artifactId>
        <version>${testcontainers.version}</version>
        <scope>test</scope>
    </dependency>
    <!-- WireMock -->
    <dependency>
        <groupId>org.wiremock</groupId>
        <artifactId>wiremock-standalone</artifactId>
        <version>${wiremock.version}</version>
        <scope>test</scope>
    </dependency>
    <!-- Awaitility -->
    <dependency>
        <groupId>org.awaitility</groupId>
        <artifactId>awaitility</artifactId>
        <version>${awaitility.version}</version>
        <scope>test</scope>
    </dependency>
</dependencies>
```

---

## 7. Test Pyramid & Coverage Guidance

### Recommended Coverage Targets

| Level | Target Coverage | Execution Time | Run Frequency |
|---|---|---|---|
| **Unit (MUnit + JUnit)** | 80%+ flow coverage, 90%+ Java line coverage | < 5 min | Every commit |
| **Integration** | All critical flows with real connectors tested | < 15 min | Every PR merge |
| **SIT** | All API contracts + cross-system happy/error paths | < 30 min | Nightly + pre-release |

### MUnit Coverage Configuration (pom.xml)

```xml
<plugin>
    <groupId>com.mulesoft.munit.tools</groupId>
    <artifactId>munit-maven-plugin</artifactId>
    <version>${munit.version}</version>
    <executions>
        <execution>
            <id>test</id>
            <phase>test</phase>
            <goals>
                <goal>test</goal>
                <goal>coverage-report</goal>
            </goals>
        </execution>
    </executions>
    <configuration>
        <coverage>
            <runCoverage>true</runCoverage>
            <failBuild>true</failBuild>
            <requiredApplicationCoverage>80</requiredApplicationCoverage>
            <requiredFlowCoverage>80</requiredFlowCoverage>
            <formats>
                <format>html</format>
                <format>json</format>
            </formats>
        </coverage>
    </configuration>
</plugin>
```

### JaCoCo Coverage for Java (pom.xml)

```xml
<plugin>
    <groupId>org.jacoco</groupId>
    <artifactId>jacoco-maven-plugin</artifactId>
    <version>${jacoco.version}</version>
    <executions>
        <execution>
            <goals><goal>prepare-agent</goal></goals>
        </execution>
        <execution>
            <id>report</id>
            <phase>test</phase>
            <goals><goal>report</goal></goals>
        </execution>
    </executions>
</plugin>
```

---

## 8. CI/CD Integration

### Maven Test Profiles

```xml
<profiles>
    <!-- Unit tests only (default) -->
    <profile>
        <id>unit</id>
        <activation><activeByDefault>true</activeByDefault></activation>
        <build>
            <plugins>
                <plugin>
                    <groupId>org.apache.maven.plugins</groupId>
                    <artifactId>maven-surefire-plugin</artifactId>
                    <configuration>
                        <groups>unit</groups>
                    </configuration>
                </plugin>
            </plugins>
        </build>
    </profile>

    <!-- Integration tests -->
    <profile>
        <id>integration</id>
        <build>
            <plugins>
                <plugin>
                    <groupId>org.apache.maven.plugins</groupId>
                    <artifactId>maven-failsafe-plugin</artifactId>
                    <configuration>
                        <groups>integration</groups>
                    </configuration>
                    <executions>
                        <execution>
                            <goals>
                                <goal>integration-test</goal>
                                <goal>verify</goal>
                            </goals>
                        </execution>
                    </executions>
                </plugin>
            </plugins>
        </build>
    </profile>

    <!-- SIT (requires environment properties) -->
    <profile>
        <id>sit</id>
        <build>
            <plugins>
                <plugin>
                    <groupId>org.apache.maven.plugins</groupId>
                    <artifactId>maven-failsafe-plugin</artifactId>
                    <configuration>
                        <groups>sit</groups>
                        <systemPropertyVariables>
                            <sit.base.url>${sit.base.url}</sit.base.url>
                            <sit.access.token>${sit.access.token}</sit.access.token>
                        </systemPropertyVariables>
                    </configuration>
                </plugin>
            </plugins>
        </build>
    </profile>
</profiles>
```

### CI Pipeline Commands

```bash
# CI Stage 1: Unit Tests
mvn clean test -Punit

# CI Stage 2: Integration Tests (requires Docker for Testcontainers)
mvn clean verify -Pintegration

# CI Stage 3: Deploy to staging
mvn deploy -DmuleDeploy -Danypoint.env=staging

# CI Stage 4: SIT against staging
mvn verify -Psit -Dsit.base.url=https://staging.example.com/api/v1 \
                  -Dsit.access.token=$STAGING_TOKEN

# CI Stage 5: Deploy to production (on SIT pass)
mvn deploy -DmuleDeploy -Danypoint.env=production
```

### Jenkins Pipeline Example

```groovy
pipeline {
    agent any
    stages {
        stage('Unit Test') {
            steps {
                sh 'mvn clean test -Punit'
            }
            post {
                always {
                    junit 'target/surefire-reports/*.xml'
                    publishHTML([reportDir: 'target/site/munit/coverage', reportFiles: 'summary.html'])
                }
            }
        }
        stage('Integration Test') {
            steps {
                sh 'mvn clean verify -Pintegration'
            }
        }
        stage('Deploy Staging') {
            steps {
                sh 'mvn deploy -DmuleDeploy -Danypoint.env=staging'
            }
        }
        stage('SIT') {
            steps {
                sh """mvn verify -Psit \
                    -Dsit.base.url=\${STAGING_API_URL} \
                    -Dsit.access.token=\${STAGING_TOKEN}"""
            }
        }
        stage('Deploy Production') {
            when { branch 'main' }
            steps {
                sh 'mvn deploy -DmuleDeploy -Danypoint.env=production'
            }
        }
    }
}
```

---

## Quick Reference

| Question | Answer |
|---|---|
| **How do I unit test a Mule flow?** | Use MUnit XML tests with `mock-when` and `assert-that` |
| **How do I unit test DataWeave?** | Use the DataWeave Testing Framework with JUnit 5 |
| **How do I unit test custom Java?** | Standard JUnit 5 + Mockito |
| **How do I integration test connectors?** | MUnit with Testcontainers (PostgreSQL, ActiveMQ, etc.) |
| **How do I SIT across multiple APIs?** | REST Assured + JUnit 5, pointing at a staging environment |
| **How do I test async flows?** | Awaitility for polling assertions |
| **How do I validate API contracts?** | REST Assured JSON Schema Validator against RAML/OAS-derived schemas |
| **How do I measure coverage?** | MUnit Coverage for flows, JaCoCo for Java classes |
| **How do I run tests in CI?** | Maven profiles: `-Punit`, `-Pintegration`, `-Psit` |

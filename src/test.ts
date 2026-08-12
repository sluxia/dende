import { convertCoordinate, convertPolygon, CRS_NAMES } from "./index";

function runTests() {
  console.log("=== Dende Coordinate Translation Engine Tests ===\n");

  let testPassed = 0;
  let testFailed = 0;

  function assert(condition: boolean, message: string) {
    if (condition) {
      console.log(`  ✅ PASS: ${message}`);
      testPassed++;
    } else {
      console.error(`  ❌ FAIL: ${message}`);
      testFailed++;
    }
  }

  // Test Case 1: Convert a coordinate in Minna / UTM Zone 31N (Lagos area)
  // Standard Easting: ~544000, Northing: ~713000
  try {
    const sourceE = 544000.00;
    const sourceN = 713000.00;
    console.log(`Test 1: Converting ${sourceE} E, ${sourceN} N from Minna/UTM 31N (EPSG:26331)...`);
    
    const result = convertCoordinate(sourceE, sourceN, "EPSG:26331");
    console.log(`  Output WGS84: Longitude: ${result.longitude.toFixed(6)}, Latitude: ${result.latitude.toFixed(6)}`);
    
    // Lagos region validation: Longitude should be ~3.39, Latitude should be ~6.44
    assert(
      result.longitude > 3.0 && result.longitude < 3.8 &&
      result.latitude > 6.0 && result.latitude < 6.8,
      "Result is inside the correct geographic boundaries for Lagos"
    );
  } catch (error) {
    console.error("Test 1 crashed:", error);
    testFailed++;
  }

  // Test Case 2: Convert a coordinate in Minna / Nigeria Mid Belt (EPSG:26392)
  // Let's test a coordinate around Abuja (Central Nigeria)
  try {
    const sourceE = 612500.00;
    const sourceN = 557300.00;
    console.log(`\nTest 2: Converting ${sourceE} E, ${sourceN} N from Nigeria Mid Belt (EPSG:26392)...`);
    
    const result = convertCoordinate(sourceE, sourceN, "EPSG:26392");
    console.log(`  Output WGS84: Longitude: ${result.longitude.toFixed(6)}, Latitude: ${result.latitude.toFixed(6)}`);
    
    // Abuja region validation: Longitude should be ~7.4, Latitude should be ~9.0
    assert(
      result.longitude > 7.0 && result.longitude < 8.0 &&
      result.latitude > 8.5 && result.latitude < 9.5,
      "Result is inside the correct geographic boundaries for Abuja region"
    );
  } catch (error) {
    console.error("Test 2 crashed:", error);
    testFailed++;
  }

  // Test Case 3: Convert a Polygon (GeoJSON Verification)
  try {
    console.log("\nTest 3: Translating a closed polygon (4 vertices) from Nigeria West Belt (EPSG:26391)...");
    const vertices: [number, number][] = [
      [220000.00, 480000.00], // Beacon 1
      [220100.00, 480000.00], // Beacon 2
      [220100.00, 480100.00], // Beacon 3
      [220000.00, 480100.00]  // Beacon 4
    ];
    
    const geojson = convertPolygon(vertices, "EPSG:26391");
    console.log(`  Generated GeoJSON type: ${geojson.type}`);
    console.log(`  First coordinate: ${geojson.coordinates[0][0]}`);
    console.log(`  Last coordinate:  ${geojson.coordinates[0][geojson.coordinates[0].length - 1]}`);
    
    // Assert structural requirements:
    // 1. Must be type "Polygon"
    // 2. Must contain 5 coordinates (4 vertices + 1 closed loop point)
    // 3. First and last point must be identical
    const coords = geojson.coordinates[0];
    assert(geojson.type === "Polygon", "GeoJSON type is 'Polygon'");
    assert(coords.length === 5, "Successfully added closing vertex (5 points total)");
    assert(
      coords[0][0] === coords[4][0] && coords[0][1] === coords[4][1],
      "First and last coordinate in the ring are identical"
    );
  } catch (error) {
    console.error("Test 3 crashed:", error);
    testFailed++;
  }

  // Summary
  console.log(`\n=== Test Summary ===`);
  console.log(`Total tests passed: ${testPassed}`);
  console.log(`Total tests failed: ${testFailed}`);

  if (testFailed > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

runTests();

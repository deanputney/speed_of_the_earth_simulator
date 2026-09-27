/**
 * Crissy Field landmarks, in feet relative to the installation center
 * (37.8047° N, 122.4628° W). x = east, z = south (North = -Z).
 *
 * Simplified from OpenStreetMap (© OpenStreetMap contributors, ODbL).
 * Terrain and shorelines come from the elevation grid in crissyFieldTerrain.js.
 */

// Golden Gate Promenade (Crissy Field), west to east
export const PROMENADE = [
    [-1717, -590], [-1582, -452], [-1440, -329], [-1428, -319], [-1338, -242], [-1272, -192],
    [-1212, -145], [-1134, -86], [-903, -26], [-688, 22], [-633, 26], [-452, 42],
    [-242, 40], [-215, 39], [-103, 34], [14, 25], [236, 8], [361, 1],
    [372, 1], [452, 3], [488, 10], [528, 17], [662, -9], [854, -41],
    [1111, -83], [1293, -112], [1480, -142], [1576, -157], [1682, -175], [1832, -199],
    [2072, -239], [2370, -287], [2437, -299]
];

export const GOLDEN_GATE = {
    // South tower pier center and deck bearing
    southTower: [-4351, -3395],
    bearing: 354.7,
    // US-101 approach roadways, from the anchorages to where they meet the ground:
    // the toll plaza on the Presidio bluff, and the Marin hillside above Lime Point
    southApproach: [
        [-4230, -1891], [-4221, -1796], [-4210, -1718], [-4193, -1642], [-4168, -1562],
        [-4131, -1475], [-4087, -1394], [-4034, -1307], [-3974, -1222]
    ],
    northApproach: [
        [-4864, -9041], [-4891, -9333], [-4902, -9446], [-4916, -9541], [-4938, -9637],
        [-4968, -9730], [-5008, -9820], [-5059, -9912], [-5112, -9990], [-5172, -10065]
    ]
};

// Landmarks placed on the terrain
export const PALACE_OF_FINE_ARTS = [4150, 700];
export const ALCATRAZ = [11460, -8000];

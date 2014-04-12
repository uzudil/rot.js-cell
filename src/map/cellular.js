/**
 * @class Cellular automaton map generator
 * @augments ROT.Map
 * @param {int} [width=ROT.DEFAULT_WIDTH]
 * @param {int} [height=ROT.DEFAULT_HEIGHT]
 * @param {object} [options] Options
 * @param {int[]} [options.born] List of neighbor counts for a new cell to be born in empty space
 * @param {int[]} [options.survive] List of neighbor counts for an existing  cell to survive
 * @param {int} [options.topology] Topology 4 or 6 or 8
 */
ROT.Map.Cellular = function(width, height, options) {
	ROT.Map.call(this, width, height);
	this._options = {
		born: [5, 6, 7, 8],
		survive: [4, 5, 6, 7, 8],
		topology: 8,
		perfect: false
	};
	this.setOptions(options);
	
	this._dirs = ROT.DIRS[this._options.topology];
	this._map = this._fillMap(0);
	this._start = [0, 0];
}
ROT.Map.Cellular.extend(ROT.Map);

/**
 * Fill the map with random values
 * @param {float} probability Probability for a cell to become alive; 0 = all empty, 1 = all full
 */
ROT.Map.Cellular.prototype.randomize = function(probability) {
	for (var i=0;i<this._width;i++) {
		for (var j=0;j<this._height;j++) {
			this._map[i][j] = (ROT.RNG.getUniform() < probability ? 1 : 0);
		}
	}
	return this;
}

/**
 * Change options.
 * @see ROT.Map.Cellular
 */
ROT.Map.Cellular.prototype.setOptions = function(options) {
	for (var p in options) { this._options[p] = options[p]; }
}

ROT.Map.Cellular.prototype.set = function(x, y, value) {
	this._map[x][y] = value;
}

ROT.Map.Cellular.prototype.create = function(callback) {
	var newMap = this._fillMap(0);
	var born = this._options.born;
	var survive = this._options.survive;


	for (var j=0;j<this._height;j++) {
		var widthStep = 1;
		var widthStart = 0;
		if (this._options.topology == 6) { 
			widthStep = 2;
			widthStart = j%2;
		}

		for (var i=widthStart; i<this._width; i+=widthStep) {

			var cur = this._map[i][j];
			var ncount = this._getNeighbors(i, j);
			
			if (cur && survive.indexOf(ncount) != -1) { /* survive */
				newMap[i][j] = 1;
			} else if (!cur && born.indexOf(ncount) != -1) { /* born */
				newMap[i][j] = 1;
			}
			
			if (callback) { callback(i, j, newMap[i][j]); }
		}
	}
	
	this._map = newMap;

	// optinially connect every space
	if (this._options.perfect) {
		this._completeMaze();	
	}
}

/**
 * Get neighbor count at [i,j] in this._map
 */
ROT.Map.Cellular.prototype._getNeighbors = function(cx, cy) {
	var result = 0;
	for (var i=0;i<this._dirs.length;i++) {
		var dir = this._dirs[i];
		var x = cx + dir[0];
		var y = cy + dir[1];
		
		if (x < 0 || x >= this._width || x < 0 || y >= this._width) { continue; }
		result += (this._map[x][y] == 1 ? 1 : 0);
	}
	
	return result;
}

/**
 * Make sure every non-wall space is accessible.
 */
ROT.Map.Cellular.prototype._completeMaze = function() {
	var all_free_space = [];
	var not_connected = {};
	// find all free space
	for(var x = 0; x < WIDTH; x++) {
		for(var y = 0; y < HEIGHT; y++) {
			if(this._freeSpace(x, y)) {
				var p = [x, y];
				not_connected[this._pointKey(p)] = p;
				all_free_space.push([x, y]);
			}
		}
	}
	var start = all_free_space[this._randomInt(0, all_free_space.length)];

	var key = this._pointKey(start);
	var connected = {};
	connected[key] = start;
	delete not_connected[key]

	// find what's connected to the starting point
	this._findConnected(connected, not_connected, [start]);

	while(Object.keys(not_connected).length > 0) {

		// find two points from not_connected to connected
		var p = this._getFromTo(connected, not_connected);
		var from = p[0]; // not_connected
		var to = p[1]; // connected

		// find everything connected to the starting point
		var local = {};
		local[this._pointKey(from)] = from;
		this._findConnected(local, not_connected, [from], true);

		// connect to a connected square
		this._tunnelToConnected(to, from, connected, not_connected);

		// now all of local is connected
		for(var k in local) {
			var pp = local[k];
			this._map[pp[0]][pp[1]] = 0;
			connected[k] = pp;
			delete not_connected[k];
		}
	}
	
	// in case the user needs the starting point
	this._start = start;
}

/**
 * Find random points to connect. Search for the closest point in the larger space. 
 * This is to minimize the length of the passage while maintaining good performance.
 */
ROT.Map.Cellular.prototype._getFromTo = function(connected, not_connected) {
	var from, to, d;
	for(var i = 0; i < 5; i++) {
		if(Object.keys(connected).length < Object.keys(not_connected).length) {
			var keys = Object.keys(connected);
			to = connected[keys[this._randomInt(0, keys.length)]]
			from = this._getClosest(to, not_connected);
		} else {
			var keys = Object.keys(not_connected);
			from = not_connected[keys[this._randomInt(0, keys.length)]]
			to = this._getClosest(from, connected);
		}
		d = (from[0] - to[0]) * (from[0] - to[0]) + (from[1] - to[1]) * (from[1] - to[1]);
		if(d < 64) break;
	}
	// console.log(">>> connected=" + to + " not_connected=" + from + " dist=" + d);
	return [from, to];
}

ROT.Map.Cellular.prototype._getClosest = function(point, space) {
	var min_point = null;
	var min_dist = null;
	for(k in space) {
		var p = space[k];
		var d = (p[0] - point[0]) * (p[0] - point[0]) + (p[1] - point[1]) * (p[1] - point[1]);
		if(min_dist == null || d < min_dist) {
			min_dist = d;
			min_point = p;
		}
	}
	return min_point;
}

ROT.Map.Cellular.prototype._findConnected = function(connected, not_connected, stack, keep_not_connected) {
	while(stack.length > 0) {
		var p = stack.splice(0, 1)[0];
		var tests = [
			[p[0] + 1, p[1]],
			[p[0] - 1, p[1]],
			[p[0],     p[1] + 1],
			[p[0],     p[1] - 1]
		];
		for(var i = 0; i < tests.length; i++) {
			var key = this._pointKey(tests[i]);
			if(connected[key] == null && this._freeSpace(tests[i][0], tests[i][1])) {
				connected[key] = tests[i];
				if(!keep_not_connected) delete not_connected[key];
				stack.push(tests[i]);
			}
		}
	}
}

ROT.Map.Cellular.prototype._tunnelToConnected = function(to, from, connected, not_connected) {
	var key = this._pointKey(from);
	var a, b;
	if(from[0] < to[0]) {
		a = from;
		b = to;
	} else {
		a = to;
		b = from;
	}
	for(var xx = a[0]; xx <= b[0]; xx++) {
		this._map[xx][a[1]] = 0;
		var p = [xx, a[1]];
		var pkey = this._pointKey(p);
		connected[pkey] = p;
		delete not_connected[pkey];
	}

	// x is now fixed
	var x = b[0];

	if(from[1] < to[1]) {
		a = from;
		b = to;
	} else {
		a = to;
		b = from;
	}
	for(var yy = a[1]; yy < b[1]; yy++) {
		this._map[x][yy] = 0;
		var p = [x, yy];
		var pkey = this._pointKey(p);
		connected[pkey] = p;
		delete not_connected[pkey];
	}
}

ROT.Map.Cellular.prototype._freeSpace = function(x, y) {
	return x >= 0 && x < this._width && y >= 0 && y < this._height && this._map[x][y] != 1;
}

ROT.Map.Cellular.prototype._pointKey = function(p) {
	return "" + p[0] + "." + p[1];
}

ROT.Map.Cellular.prototype._randomInt = function(from, to) {
	return ((ROT.RNG.getUniform() * (to - from)) + from)|0;
}

ROT.Map.Cellular.prototype.getStart = function() {
	return this._start;
}

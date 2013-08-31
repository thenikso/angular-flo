(function(angular, window, document, undefined) {'use strict';

var TYPE_ANY = 'all',
    DEFAULT_OUT = 'out';

var flo = angular.module('ngFlo', []);

flo.provider('$component', ['$injector', function($injector) {
	var components = {};

	// TODO make an $inhibit property that avoid computation, will be changed by network if there are output $connections?
	// inhibit and only enable if $$watchers has out ports watchers? not possible...
	function componentFactory(name, locals) {
		var settings = components[name];
		if (!angular.isObject(settings)) {
			throw "$component: No component '" + name + "' found.";
		}

		// Get ins watcher expression
		var insExp = buildInsExpression(settings.ins);

		// Build instantiable component
		var transformer = settings.transformer;
		// TODO use options.portsAlias to rename ports
		if (angular.isFunction(settings.compile)) {
			// TODO throw if transformer is set
			transformer = $injector.invoke(settings.compile, settings, locals);
			// TODO throw if transformer is not a function
		}

		var instance = function(scope, options) {
			options = options || {};

			// Validate transformer outputs
			function component() {
				var ins = parseInput(settings.ins, arguments);
				var outs = transformer.apply(scope, ins); // todo should this be the scope? what when it $destroy?
				return parseOutput(settings.outs, outs);
			};
			// Apply wathers to scope
			if (scope) {
				if (insExp) {
					var cancelInsWatcher;

					var watchIns = function() {
						return scope.$watchCollection(insExp, function(ins, oldIns) {
							// Get outputs
							var outs = component.apply(scope, ins);
							// Push output to scope
							angular.extend(scope, outs);
						});
					}

					var outsNames = [];
					if (options.noInhibition !== true
						&& angular.isArray(settings.outs)
						&& settings.outs.length > 0) {
						for (var name, i = settings.outs.length - 1; i >= 0; i--) {
							name = settings.outs[i];
							if (angular.isObject(name)) name = name.name;
							outsNames.unshift(name);
						}
						// Check if to de-inhibit the component
						scope.$watchCollection('$$watchers', function(watchers) {
							var shouldInhibit = true;
							for (var i = watchers.length - 1; i >= 0; i--) {
								if (angular.isString(watchers[i].exp)
									&& outsNames.indexOf(watchers[i].exp) >= 0) {
									shouldInhibit = false;
									break;
								}
							}
							if (shouldInhibit) {
								if (angular.isFunction(cancelInsWatcher)) {
									cancelInsWatcher();
									cancelInsWatcher = null;
								}
							} else if (!cancelInsWatcher) {
								cancelInsWatcher = watchIns();
							}
						});
					} else {
						watchIns();
					}
				}
				// Remove componet on scope destroy
				scope.$component = instance;
				scope.$on('$destroy', function() {
					scope.$component = null;
					// TODO needed?
				});
			}
			//
			return component;
		}

		// Add metadata to component isntance
		instance.ins = angular.copy(settings.ins);
		instance.outs = angular.copy(settings.outs);

		return instance;
	}

	var componentProvider = {
		// TODO accept a graph input and create a network component
		register: function(name, ins, outs, transformer) {
			if (angular.isObject(name)) {
				var options;
				for (var n in name) {
					options = angular.copy(name[n]);
					options.ins = validateComponentPorts(options.ins);
					options.outs = validateComponentPorts(options.outs);
					components[n] = options;
				}
				return componentProvider;
			}
			if (!angular.isString(name)) {
				throw "$componentProvider: Component name should be a string, got: " + name;
				return componentProvider;
			}
			if (angular.isFunction(ins)) {
				transformer = ins;
				ins = undefined;
				if (!angular.isDefined(transformer.$ins)) {
					transformer.$ins = $injector.annotate(transformer);
				}
			}
			if (!angular.isDefined(ins)) {
				ins = transformer.$ins;
			}
			if (!angular.isDefined(outs)) {
				outs = transformer.$outs;
			}
			components[name] = {
				ins: validateComponentPorts(ins),
				outs: validateComponentPorts(outs),
				transformer: transformer
			};
			return componentProvider;
		},

		$get: function() {
			return componentFactory;
		}
	};

	return componentProvider;

	function validateComponentPorts(ports) {
		if (!ports) return null;
		if (!angular.isArray(ports)) {
			throw "$componentProvider: Invalid ports: " + ports
		}
		var validatedPorts = [];
		for (var port, i = ports.length - 1; i >= 0; i--) {
			port = ports[i];
			if (angular.isString(port)) {
				port = { name: port, type: TYPE_ANY };
			} else if (!angular.isString(port.name)) {
				throw "$componentProvider: Invalid port name: " + port.name
			} else if (!angular.isDefined(port.type)) {
				port.type = TYPE_ANY
			}
			validatedPorts.unshift(port);
		}
		return validatedPorts;
	}

	function buildInsExpression(ins) {
		var insExp = null;
		if (angular.isArray(ins)) {
			insExp = '[';
			for (var name, i = ins.length - 1; i >= 0; i--) {
				name = ins[i];
				if (angular.isObject(name)) name = name.name;
				insExp += name + ',';
			}
			if (insExp.length > 1) {
				insExp = insExp.substr(0, insExp.length - 1);
				insExp += ']';
			} else {
				insExp = null;
			}
		}
		return insExp
	}

	function parseInput(ins, values) {
		if (!angular.isArray(ins)) {
			return values;
		}
		var validated = [];
		for (var port, i = ins.length - 1; i >= 0; i--) {
			port = ins[i];
			checkPortType(port, values[i]);
			validated.unshift(values[i]);
		}
		return validated;
	}

	function parseOutput(outs, value) {
		if (!angular.isObject(value)) {
			var outputName = DEFAULT_OUT,
			    output = {};
			if (angular.isArray(outs) && outs.length > 0) {
				outputName = outs[0].name;
			}
			output[outputName] = value;
			value = output;
		}
		if (!angular.isArray(outs)) {
			return value;
		}
		var validated = {};
		for (var port, i = outs.length - 1; i >= 0; i--) {
			port = outs[i];
			checkPortType(port, value[port.name]);
			validated[port.name] = value[port.name];
		}
		return validated;
	}

	function checkPortType(port, value) {
		if(angular.isString(port.type) && port.type != TYPE_ANY
		&& angular.isDefined(value) && value && typeof value != port.type) {
			throw "Type error!! TODO make me better: " + port.name;
		}
	}
}]);

flo.provider('$network', function() {

	function network($rootScope, $parse, $component, name, graphOrDecl) {
		this.$scope = $rootScope.$new(true);
		this.$parse = $parse;
		this.$component = $component;

		this.$scope.name = name;
		this.$scope.$processes = {};
		this.$scope.$connections = {}; // to -> {from: data:}
		if (angular.isObject(graphOrDecl)) {
			this.graph(graphOrDecl);
		} else if (angular.isString(graphOrDecl)) {
			// TODO this.decl ...
		}
		// TODO watch/parse graph if present
	}

	network.prototype.process = function(name, component, portsAlias) {
		var self = this;
		// Get component
		if (angular.isString(component)) {
			component = this.$component(component);
		}
		if (!angular.isFunction(component)) {
			throw "$network: Invalid component: " + component;
		}
		// Destroy previous process if present
		var oldProcess = this.$scope.$processes[name];
		if (angular.isDefined(oldProcess)) {
			oldProcess.$destroy();
		}
		// Create new process
		var processScope = this.$scope.$new(true);
		this.$scope.$processes[name] = processScope;
		processScope.$on('$destroy', function() {
			delete self.$scope.$processes[name];
		});
		// Initalize component
		component(processScope, portsAlias);
		return this;
	};

	network.prototype.connection = function(from, to) {
		var self = this,
		    target = parseProcessPath(to),
		    wire = this.$parse(target.port).assign,
		    processScope = this.$scope.$processes[target.process];
		var endConnection = this.probe(from, function(value) {
			wire(processScope, value);
		});
		var connection = {
			from: from,
			$destroy: function() {
				delete self.$scope.$connections[to];
				endConnection();
			}
		};
		this.$scope.$connections[to] = connection;
		return this;
	};

	network.prototype.constant = function(data, to) {
		var self = this,
		    target = parseProcessPath(to),
		    wire = this.$parse(target.port).assign;
		wire(this.$scope.$processes[target.process], data);
		//
		var connection = {
			data: data,
			$destroy: function() {
				delete self.$scope.$connections[to];
			}
		};
		this.$scope.$connections[to] = connection;
		return this;
	};

	network.prototype.probe = function(path, handler) {
		path = parseProcessPath(path);
		var processScope = this.$scope.$processes[path.process];
		return processScope.$watch(path.port, handler);
	};

	network.prototype.empty = function() {
		for (var to in this.$scope.$connections) {
			this.$scope.$connections[to].$destroy();
		}
		for (var name in this.$scope.$processes) {
			this.$scope.$processes[name].$destroy();
		}
	};

	network.prototype.graph = function(graph) {
		if (arguments.length == 0) {
			return this.$scope.graph;
		}
		if (!angular.isObject(graph)) {
			throw "$network: Invalid graph: " + graph;
		}
		this.empty();
		if (angular.isObject(graph.processes)) {
			var process;
			for (var name in graph.processes) {
				process = graph.processes[name];
				this.process(name, process.component, process.portsAlias);
			}
		}
		if (angular.isObject(graph.connections)) {
			for (var to in graph.connections) {
				con = graph.connections[to];
				if (angular.isDefined(con.from)) {
					this.connection(con.from, to);
				} else if (angular.isDefined(con.data)) {
					this.constant(con.data, to);
				}
			}
		}
		this.$scope.graph = graph;
		return this;
	};

	var networkProvider = {
		$get: ['$rootScope', '$parse', '$component', function($rootScope, $parse, $component) {
			return function(name, graph) {
				return new network($rootScope, $parse, $component, name, graph);
			};
		}]
	}

	return networkProvider;

	function parseProcessPath(path) {
		var dot;
		if(!angular.isString(path)
			|| path.length < 1
			|| path[0] == '.'
			|| (dot = path.lastIndexOf('.')) < 1) {
			throw "$network: Invalid process path: " + path;
		}
		return {
			process: path.substr(0, dot).replace(/^[\s"'\[]+|[\s"'\]]+$/g, ''),
			port: path.substr(dot + 1)
		};
	}
});

flo.directive('floNetwork', function() {
	return {
		restrict: 'EAC',
		compile: function(scope, element, transclude) {
			return function(scope, element, args) {

			}
		}
	};
});

})(angular, window, document);

angular.element(document).find('head').prepend('<style type="text/css">@charset "UTF-8";[flo\\:network],[flo-network],[data-flo-network],[x-flo-network],.flo-network,.x-flo-network{display:none !important;}</style>');

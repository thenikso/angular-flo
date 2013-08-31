(function(angular, window, document, undefined) {'use strict';

var TYPE_ANY = 'all',
    DEFAULT_OUT = 'out';

var flo = angular.module('ngFlo', []);

flo.provider('$component', ['$injector', function($injector) {
	var components = {};

	/**
	 * @ngdoc object
	 * @name flo.$componentProvider
	 * @description
	 * The {@link flo.$component $component service} is used to retrieve registered
	 * components and create anonymous ones.
	 *
	 * This provider allows component registration via the
	 * {@link flo.$componentProvider#register register} method.
	 */
	function $ComponentProvider() {

		/**
		 * @ngdoc function
		 * @name flo.$componentProvider#register
		 * @methodOf flo.$componentProvider
		 * @requires $injector
		 *
		 * @param {string|Object} name Component name. If called with an object then
		 * 		it is copied into the registered components after ports validation.
		 * 		The object should have this format:
		 *
		 * 			* `name`: The name of the component to register. This should be an
		 * 				object iself with the properties of the component:
		 * 				* `ins`: see the `ins` parameter;
		 * 				* `outs`: see the `outs` parameter;
		 * 				* `transformer`: see the `transformer` parameter;
		 * 				* `compile`: an injectable function that should return a transformer function.
		 *
		 * @param {Array|Function} ins If called with a function, it is considered then
		 * 		it is considered the transformer function, in which case the input port
		 * 		names will be derived by the function parameters names using
		 * 		{@link ng.$injector#annotate $injector.annotate}. Otherwise it is the
		 * 		array of input ports. The array may contain objects like:
		 *
		 * 			* `{ name:<*String*>, validate:<*String|Function*> }`:
		 * 				* `name`: the name of the port;
		 * 				* `validate`: If it is a string, the type of the port input will be
		 * 					checked with `typeof`. The special type `all` can be used to accept
		 * 					any value. If it is a function, it will be called with the port
		 * 					value uppon validation and it should return a truthy or falsy value.
		 *
		 * 		The port array can contains only port name strings; in which case they
		 * 		will be validated and transformed to accept any kind of value.
		 *
		 * @param {Array=} outs The declaration of output ports. This array should have
		 * 		the same format as `ins`.
		 *
		 * @param {Function} transformer Component transformer function. It can be annotated
		 * 		with `$ins` and `$outs` which will only be used if the corresponding paramenter
		 * 		is not specified. The transformer will receive a number of input arguments
		 * 		equal an in the same order as the `ins` array. It should return an object
		 * 		with keys equal to the `outs` array port names. If this method returns a
		 * 		plain value, it will be converted to an object with the first `outs` port
		 * 		name as key. If no `outs` are specified, the return object key will be "out".
		 */
		 this.register = function(name, ins, outs, transformer) {
			if (angular.isObject(name)) {
				var options;
				for (var n in name) {
					options = angular.copy(name[n]);
					options.ins = validateComponentPorts(options.ins);
					options.outs = validateComponentPorts(options.outs, options.ins);
					components[n] = options;
				}
				return this;
			}

			if (!angular.isString(name)) {
				throw "$componentProvider: Invalid component name: " + name;
				return this;
			}

			if (angular.isFunction(ins)) {
				transformer = ins;
				ins = undefined;
				if (!angular.isDefined(transformer.$ins)) {
					transformer.$ins = $injector.annotate(transformer);
				}
			}

			if (!angular.isFunction(transformer)) {
				throw "$componentProvider: Invalid transformer: " + transformer;
			}

			if (!angular.isDefined(ins)) {
				ins = transformer.$ins;
			}

			if (!angular.isDefined(outs)) {
				outs = transformer.$outs;
			}

			if (!angular.isDefined(outs)) {
				outs = [DEFAULT_OUT];
			}

			ins = validateComponentPorts(ins);
			outs = validateComponentPorts(outs, ins);
			components[name] = {
				ins: ins,
				outs: outs,
				transformer: transformer
			};

			return this;
		};

		this.$get = function() {

			/**
			 * @ngdoc function
			 * @name flo.$component
			 * @requires $injector
			 *
			 * @param {string|Function} name If called with a function then it's considered to be the
			 *    annotated transformer function of an anonymous component.
			 * 		Otherwise it's considered to be a string which is used to retrieve
			 * 		the component constructor registered via `$componentProvider`.
			 *
			 * @param {Object} locals Injection locals for the `compile` function of
			 * 		the registered controller. If `name` is a funciton than this object
			 * 		is instead considered as the `outs` array for the anonymous component.
			 * @return {Function} A function that can be used to attach the controller
			 * 		to a scope.
			 *
			 * @description
			 * `$component` service is responsible for retrieving and preparing a component.
			 *
			 * The returned functions should be used to attach the component to a scope:
			 * `$component('MyComponent')($scope, { noInhibition: true })`.
			 *
			 * By attaching a component to a scope, the component will not become active
			 * unless an output port is directly watched in the given scope or the
			 * `noInhibition` option is set to `true`.
			 *
			 * Once active, the component will watch for input port names in the given
			 * scope and set the scope keys corresponding to output port names with
			 * the result of the transfomer function.
			 *
			 * Options are not required and they can be:
			 *
			 * 	* `noInhibition`: a boolean value indicating if the inhibition logic
			 * 		should be employed;
			 * 	* `aliasPorts`: an object containig port name as key and a string as value.
			 * 		This mapping will be used to watch and write different properties of
			 * 		the scope to avoid conflicts.
			 *
			 * The results of applying a component to a scope is another function that
			 * performs the validated transform function.
			 */
			return function(name, locals) {
				var settings = null;

				if (angular.isString(name)) {
					settings = components[name];
				} else if (angular.isFunction(name)) {
					settings = {};
					settings.transformer = name;
					settings.ins = validateComponentPorts($injector.annotate(name));
					settings.outs = validateComponentPorts(locals);
					locals = null;
				}

				if (!angular.isObject(settings)) {
					throw "$component: No component '" + name + "' found.";
				}

				var insExp = buildInsExpression(settings.ins);

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
						var outs = transformer.apply(scope, ins);
						return parseOutput(settings.outs, outs);
					};
					// Apply wathers to scope
					if (scope) {
						// Remove componet on scope destroy
						(scope.$components = scope.$components || []).push(instance);
						scope.$on('$destroy', function() {
							scope.$components.splice(scope.$components.indexOf(instance), 1);
						});

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

							if (options.noInhibition !== true
								&& angular.isArray(settings.outs)
								&& settings.outs.length > 0) {
								// Check if to de-inhibit the component
								scope.$watchCollection('$$watchers', function(watchers) {
									var shouldInhibit = true;
									for (var i = watchers.length - 1; i >= 0; i--) {
										if (angular.isString(watchers[i].exp)
											&& angular.isDefined(instance.getOutNamed(watchers[i].exp))) {
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
					}
					//
					return component;
				}

				// Add metadata to component isntance
				function getPortNamedFactory(ports) {
					return function(name) {
						if (!ports) return;
						for (var i = ports.length - 1; i >= 0; i--) {
							if (ports[i].name === name) {
								return ports[i];
							}
						}
					}
				}
				instance.ins = angular.copy(settings.ins);
				instance.getInNamed = getPortNamedFactory(instance.ins);
				instance.outs = angular.copy(settings.outs);
				instance.getOutNamed = getPortNamedFactory(instance.outs);

				return instance;
			}
		}

	}

	return new $ComponentProvider;

	function validateComponentPorts(ports, otherValidatedPorts) {
		if (!ports) return null;
		if (!angular.isArray(ports)) {
			throw "$componentProvider: Invalid ports: " + ports
		}
		var validatedPorts = [];
		for (var port, i = ports.length - 1; i >= 0; i--) {
			port = ports[i];
			if (angular.isString(port)) {
				port = { name: port, validate: TYPE_ANY };
			} else if (!angular.isString(port.name)) {
				throw "$componentProvider: Invalid port name: " + port.name
			} else if (!angular.isDefined(port.validate)) {
				port.validate = TYPE_ANY
			}
			if (port.name.match(/\s+/) != null) {
				throw "$componentProvider: Port name must not contain spaces; got: " + port.name
			}
			angular.forEach(validatedPorts, function(vp) {
				if (vp.name == port.name) {
					throw "$componentProvider: Duplicated port name: " + port.name;
				}
			});
			// check for duplicate input/output ports
			if (angular.isArray(otherValidatedPorts)) {
				for (var j = otherValidatedPorts.length - 1; j >= 0; j--) {
					if (otherValidatedPorts[j].name == port.name) {
						throw "$componentProvider: Duplicated port name: " + port.name;
					}
				}
			}
			// Add to validation
			validatedPorts.unshift(port);
		}
		return validatedPorts;
	}

	function buildInsExpression(ins) {
		var insExp = null;
		if (angular.isArray(ins)) {
			insExp = ']';
			for (var name, i = ins.length - 1; i >= 0; i--) {
				name = ins[i];
				if (angular.isObject(name)) name = name.name;
				insExp = ',' + name + insExp;
			}
			if (insExp.length > 1) {
				insExp = insExp.substr(1);
				insExp = '[' + insExp;
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
		if (angular.isDefined(value) && (
			(angular.isFunction(port.validate) && !port.validate(value))
			||
			(value && angular.isString(port.validate) && port.validate != TYPE_ANY && typeof value != port.validate)
		)) {
			throw "Type error!! TODO make me better: " + port.name;
		}
	}
}]);

flo.provider('$network', function() {

	function network($rootScope, $parse, $component, name, graphOrDecl) {
		this.$scope = $rootScope.$new(true);
		this.$parse = $parse;
		this.$component = $component;

		if (angular.isDefined(name)) {
			this.$scope.$network = name;
		}
		this.$scope.$processes = {};
		this.$scope.$connections = {}; // to -> {from: data:}
		if (angular.isObject(graphOrDecl)) {
			this.graph(graphOrDecl);
		} else if (angular.isString(graphOrDecl)) {
			// TODO this.decl ...
		}
		// TODO watch/parse graph if present
	}

	network.prototype.process = function(name, component, options) {
		var self = this;
		// Get component
		if (angular.isString(component) || angular.isFunction(component)) {
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
		component(processScope, options);
		return this;
	};

	network.prototype.connection = function(from, to) {
		var self = this,
		    target = parseProcessPath(to),
		    wire = this.$parse(target.port).assign,
		    processScope = this.$scope.$processes[target.process];
		to = target.process + '.' + target.port;
		if (angular.isDefined(this.$scope.$connections[to])) {
			throw "$network: A connection to `" + to + "` is already present";
		}
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

	network.prototype.data = function(data, to) {
		var self = this,
		    target = parseProcessPath(to),
		    wire = this.$parse(target.port).assign;
		to = target.process + '.' + target.port;
		if (angular.isDefined(this.$scope.$connections[to])) {
			throw "$network: A connection to `" + to + "` is already present";
		}
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
		if (!angular.isDefined(processScope)) {
			throw "$network: Invalid process to probe: " + path.process;
		}
		if (!angular.isDefined(processScope.$components[0].getInNamed(path.port))
		&& !angular.isDefined(processScope.$components[0].getOutNamed(path.port))) {
			throw "$network: Invalid port to probe `" + path.port + "` for process `" + path.process + "`";
		}
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
				var con = graph.connections[to];
				if (angular.isDefined(con.from)) {
					this.connection(con.from, to);
				} else if (angular.isDefined(con.data)) {
					this.data(con.data, to);
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

angular.element(document).find('head').prepend('<style type="text/css">@charset "UTF-8";flo-network,[flo\\:network],[flo-network],[data-flo-network],[x-flo-network],.flo-network,.x-flo-network{display:none !important;}</style>');

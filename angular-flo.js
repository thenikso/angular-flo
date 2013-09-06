(function(angular, window, document, undefined) {"use strict";var TYPE_ANY = 'all',
    DEFAULT_OUT = 'out';

var flo = angular.module('ngFlo', []);

flo.provider('$component', ['$injector', function($injector) {
	var components = {};

	/**
	 * @ngdoc object
	 * @name ngFlo.$componentProvider
	 * @description
	 * The {@link ngFlo.$component $component service} is used to retrieve registered
	 * components and create anonymous ones.
	 *
	 * This provider allows component registration via the
	 * {@link ngFlo.$componentProvider#register register} method.
	 */
	function $ComponentProvider() {
		var $componentProvider = this;

		/**
		 * @ngdoc function
		 * @name ngFlo.$componentProvider#register
		 * @methodOf ngFlo.$componentProvider
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
		 * 					Besides regular AngularJS injection, a `parameters` object can be injected and it
		 * 					will receive the parameters specified when a component is retrieved.
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

		this.$get = ['$injector', function ($injector) {

			/**
			 * @ngdoc function
			 * @name ngFlo.$component
			 * @requires $injector
			 *
			 * @param {string|Function} name If called with a function then it's considered to be the
			 *    annotated transformer function of an anonymous component.
			 * 		Otherwise it's considered to be a string which is used to retrieve
			 * 		the component constructor registered via `$componentProvider`.
			 *
			 * @param {Object} parameters Injection parameters for the `compile` function of
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
			 * 	* `portsAlias`: an object containig port name as key and a string as value.
			 * 		This mapping will be used to watch and write different properties of
			 * 		the scope to avoid conflicts.
			 *
			 * The results of applying a component to a scope is another function that
			 * performs the validated transform function.
			 *
			 * Components are designed mainly to be used in conjunction with
			 * {@link ngFlo.$network $network} but they can also be used independently
			 * on regular scopes:
			 *
			 * @example
			 * <pre>
			 * // A component attached to a scope that will get inputs from `$scope.aLocalModel`
			 * // and push its output to `$scope.anotherLocalModel`.
			 * $component('aComponent')($scope, {
			 * 	noInhibition: true,
			 * 	portsAlias: {
			 * 		'in': 'aLocalModel',
			 * 		'out': 'anotherLocalModel'
			 * 	}});
			 * </pre>
			 */
			var $component = function(name, parameters) {
				var componentSettings = null;

				if (angular.isString(name)) {
					componentSettings = components[name];
				} else if (angular.isFunction(name)) {
					componentSettings = {};
					componentSettings.transformer = name;
					componentSettings.ins = validateComponentPorts($injector.annotate(name));
					componentSettings.outs = validateComponentPorts(parameters);
					parameters = null;
				}

				if (!angular.isObject(componentSettings)) {
					throw "$component: No component '" + name + "' found.";
				}

				var transformer = componentSettings.transformer;
				if (angular.isFunction(componentSettings.compile)) {
					transformer = $injector.invoke(componentSettings.compile, componentSettings, { parameters: parameters || {} });
				}

				if (!angular.isFunction(transformer)) {
					throw "$component: Invalid transformer: " + transformer;
				}

				var component = function(scope, options) {
					options = options ? angular.copy(options) : {};

					// Prepare instance ports by aliasing them
					var instanceIns = aliasPorts(angular.copy(component.ins), options.portsAlias),
					    instanceOuts = aliasPorts(angular.copy(component.outs), options.portsAlias, instanceIns);

					// The component instance that will be returned by this function.
					// It will be automatically called if instanceIns aliased port names
					// properties changes in the scope (but only if the instance is not inhibited).
					function componentInstance() {
						var ins = validateInput(instanceIns, arguments);
						var outs = transformer.apply(componentInstance, ins);
						return validateAndAliasOutput(component.outs, outs, options.portsAlias);
					};

					componentInstance.componentName = name;
					componentInstance.baseComponent = component;
					componentInstance.ins = instanceIns;
					componentInstance.outs = instanceOuts;
					componentInstance.getInNamed = getPortNamedFactory(instanceIns);
					componentInstance.getOutNamed = getPortNamedFactory(instanceOuts);

					// Early exit if no scope is specified
					// This way the component can be used only as a function to manually
					// convert validated inputs to a validated output object
					if (!scope) return componentInstance;

					// The given scope will be decorated with a $components array containing
					// instances of components attached to the scope.
					(scope.$components = scope.$components || []).push(componentInstance);
					scope.$on('$destroy', function() {
						scope.$components.splice(scope.$components.indexOf(componentInstance), 1);
					});

					// insExp will be an expression string of an array that can be watched
					// to monitor input changes. If no such expression can be build we exit.
					var insExp = insWatchExpression(instanceIns);
					if (!insExp) return componentInstance;

					// Function to start watching for inputs changes and extend the scope
					// with validated output object.
					var watchIns = function() {
						return scope.$watchCollection(insExp, function(ins, oldIns) {
							var outs = componentInstance.apply(scope, ins);
							angular.extend(scope, outs);
						});
					}

					// If auto inhibition should not be adopted, start watching ins and return.
					if (options.noInhibition == true || instanceOuts.length == 0) {
						watchIns();
						return componentInstance;
					}

					// To auto inhibit, see if direct scope watchers contains any aliased
					// output port. This will not work if the output ports are watched via
					// a path through a parent scope.
					var cancelWatchIns;
					scope.$watchCollection('$$watchers', function(watchers) {
						var shouldInhibit = true;
						for (var exp, i = watchers.length - 1; i >= 0; i--) {
							exp =watchers[i].exp;
							if (angular.isString(exp) && componentInstance.getOutNamed(exp)) {
								shouldInhibit = false;
								break;
							}
						}
						if (shouldInhibit) {
							if (angular.isFunction(cancelWatchIns)) {
								cancelWatchIns();
								cancelWatchIns = null;
							}
						} else if (!cancelWatchIns) {
							cancelWatchIns = watchIns();
						}
					});

					return componentInstance;
				}

				// Add metadata to component constructor
				component.componentName = name;
				component.ins = angular.copy(componentSettings.ins);
				component.getInNamed = getPortNamedFactory(component.ins);
				component.outs = angular.copy(componentSettings.outs);
				component.getOutNamed = getPortNamedFactory(component.outs);

				return component;
			}

			$component.register = $componentProvider.register;

			$component.names = function () {
				return Object.keys(components);
			};

			return $component;
		}]

	}

	return new $ComponentProvider;

	// Genrates a funciton that will search for a port with a provided name
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

	// From an array of port names or port objects, the function generates
	// an array of validated port objects. The validation will check:
	// 	* That ports is an array
	// 	* That port names are valid (no spaces or points allawed)
	// 	* That port names are unique (case insensitive)
	// 	* That port names are unique from other validated ports array if provided.
	function validateComponentPorts(ports, otherValidatedPorts) {
		if (!ports) return [];

		if (!angular.isArray(ports)) {
			throw "$componentProvider: Invalid ports: " + ports
		}

		var validatedPorts = [];
		angular.forEach(ports, function(port) {
			// Generate validable port object
			if (angular.isString(port)) {
				port = { name: port, validate: TYPE_ANY };
			} else if (!angular.isString(port.name)) {
				throw "$componentProvider: Invalid port name: " + port.name
			} else if (!angular.isDefined(port.validate)) {
				port.validate = TYPE_ANY
			}
			// Validate port name syntax
			if (port.name.match(/[\s\.]/) != null) {
				throw "$componentProvider: Port name must not contain spaces; got: " + port.name
			}
			// Validate port name uniqueness in previously validated ports
			var lowerPortName = port.name.toLowerCase();
			angular.forEach(validatedPorts, function(vp) {
				if (vp.name.toLowerCase() == lowerPortName) {
					throw "$componentProvider: Duplicated port name: " + port.name;
				}
			});
			// Validate port name uniqueness in additional ports input
			if (angular.isArray(otherValidatedPorts)) {
				angular.forEach(otherValidatedPorts, function(vp) {
					if (vp.name.toLowerCase() == lowerPortName) {
						throw "$componentProvider: Duplicated port name: " + port.name;
					}
				});
			}
			// Port is validated
			validatedPorts.push(port);
		});
		return validatedPorts;
	}

	// Construct an AngularJS watchable expression in the form:
	// `[inputName,inputName2,...]`. This expression can be watched with a
	// `scope.$watchCollection` to receive input ports updates.
	function insWatchExpression(ins) {
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

	// Given a validated ports array and a map of port name to aliases, returns
	// a validated ports array with substituted names.
	function aliasPorts(ports, aliases, otherValidatedPorts) {
		if (!aliases) return ports;
		var alias;
		angular.forEach(ports, function(port) {
			alias = aliases[port.name];
			if (alias) {
				port.name = alias;
			}
		});
		return validateComponentPorts(ports, otherValidatedPorts);
	}

	// Check that the input values array have a correct type for the port in the same
	// position. Returns values or throw.
	function validateInput(ins, values) {
		angular.forEach(ins, function(port, i) {
			validateValueForPort(port, values[i]);
		});
		return values;
	}

	function validateAndAliasOutput(outs, value, aliases) {
		// Build validable output value
		if (!angular.isObject(value)) {
			var outputName = DEFAULT_OUT,
			    output = {};
			if (angular.isArray(outs) && outs.length > 0) {
				outputName = outs[0].name;
			}
			output[outputName] = value;
			value = output;
		}
		// Generate a validated output object containing only expected output
		var validated = {};
		angular.forEach(outs, function(port) {
			validateValueForPort(port, value[port.name]);
			validated[port.name] = value[port.name];
		});
		// Aliases output port names if needed
		if (!aliases) return validated;

		var aliased = {}, alias;
		angular.forEach(validated, function(val, key) {
			alias = aliases[key];
			if (alias) {
				aliased[alias] = val;
			} else {
				aliased[key] = val;
			}
		});
		return aliased;
	}

	// Throws if the provided value is not validated by the port `validate` property.
	function validateValueForPort(port, value) {
		if (angular.isDefined(value) && (
			(angular.isFunction(port.validate) && !port.validate(value))
			||
			(value && angular.isString(port.validate) && port.validate != TYPE_ANY && typeof value != port.validate)
		)) {
			throw "$component: Invalid value for port '" + port.name + "'" +
			(angular.isString(port.validate) ? (" expected " + port.validate) : "");
		}
	}
}]);

flo.provider('$network', function() {

	/**
	 * @ngdoc object
	 * @name ngFlo.$network
	 * @requires $rootScope, $component
	 *
	 * @param {string=} name The name of the network.
	 *
	 * @param {Object=|stirng=} graphOrFbp If an object, it will be passed to the
	 * 		{@link ngFlo.$network#graph graph} method. If a string it will be passed to
	 * 		{@link ngFlo.$network#fbp fbp}.
	 *
	 * @description
	 * `$network` service is responsible for declaring component processes and connect
	 * them via connections.
	 *
	 * @example
	 * <pre>
	 * // A network that will watch for `$scope.nameModel` changes and will update
	 * // `$scope.greeting` with the result of the network computation.
	 * $network('Green')
	 * 	.process('Exclamate', 'string-append')
	 * 	.process('Shout', 'string-uppercase')
	 * 	.connection('Exclamate.out', 'Shout.in')
	 * 	.data('!', 'Exclamate.second')
	 * 	.import($scope, { 'Exclamate.first':'nameModel' })
	 * 	.export($scope, { 'greeting':'Shout.out' });
	 * </pre>
	 */
	function network($rootScope, $component, name, graphOrFbp) {
		this.$scope = $rootScope.$new(true);
		this.$component = $component;

		if (angular.isDefined(name)) {
			this.$scope.$network = name;
		}

		this.$scope.$processes = {};
		this.$scope.$connections = {};

		if (angular.isObject(graphOrFbp)) {
			this.graph(graphOrFbp);
		} else if (angular.isString(graphOrFbp)) {
			// TODO this.fbp(graphOrFbp)
		}
	}

	/**
	 * @ngdoc method
	 * @name AUTO.$network#process
	 * @methodOf AUTO.$network
	 *
	 * @description
	 * Creates a process out of a {@link ngFlo.$component component} in the network.
	 * The process has its own isolated scope.
	 *
	 * @param {!string} name The name to identify the process. This name will be
	 * 		used to identify the process when building connections.
	 * @param {!string|!function} component If called with a string, the name of a
	 * 		component to instantiate for the process. If called with a function, it
	 * 		will be considered as the transformer function of an anonymous component.
	 * @param {Object=} options Optional object. If preset they are passed to the
	 * 		component instantiation function.
	 * @returns {*} the network.
	 */
	network.prototype.process = function(name, component, options) {
		var self = this;
		// Get component or build an anonymous one
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

	/**
	 * @ngdoc method
	 * @name AUTO.$network#connection
	 * @methodOf AUTO.$network
	 *
	 * @description
	 * Creates a connection between two {@link ngFlo.$network processes} ports.
	 * The process in the `from` argument will forward the output of the specified
	 * port to the specified input port of the process in the `to` argument.
	 *
	 * Only one connection per input port is allowed. This may change in the future.
	 *
	 * @param {!string} from The path of the `<process name>.<output port>` to connect from.
	 * @param {!string} to The path to connect to.
	 * @returns {*} the network.
	 */
	network.prototype.connection = function(from, to) {
		var self = this,
		    target = parseProcessPath(to),
		    processScope = this.$scope.$processes[target.process];
		// Normalize destination path
		to = target.process + '.' + target.port;
		// Do not allaw overriding of existing connections.
		if (angular.isDefined(this.$scope.$connections[to])) {
			throw "$network: A connection to `" + to + "` is already present";
		}
		// Actual port value connection
		var endConnection = this.probe(from, function(value) {
			processScope[target.port] = value;
		});
		// Connection object to manage the connection
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

	/**
	 * @ngdoc method
	 * @name AUTO.$network#data
	 * @methodOf AUTO.$network
	 *
	 * @description
	 * Sets the value of the input process port to a constant and occupy the
	 * connection.
	 *
	 * Only one connection per input port is allowed. This may change in the future.
	 *
	 * @param {!*} data The data value to set.
	 * @param {!string} to The path to connect to.
	 * @returns {*} the network.
	 */
	network.prototype.data = function(data, to) {
		var self = this,
		    target = parseProcessPath(to);
		to = target.process + '.' + target.port;
		if (angular.isDefined(this.$scope.$connections[to])) {
			throw "$network: A connection to `" + to + "` is already present";
		}
		this.$scope.$processes[target.process][target.port] = data;
		var connection = {
			data: data,
			$destroy: function() {
				delete self.$scope.$connections[to];
			}
		};
		this.$scope.$connections[to] = connection;
		return this;
	};

	/**
	 * @ngdoc method
	 * @name AUTO.$network#probe
	 * @methodOf AUTO.$network
	 *
	 * @description
	 * Watches any process port in the network and pass the current value to the
	 * listener function.
	 *
	 * @param {!string} path The path of the `<process name>.<port name>` to probe.
	 * @param {!function} to A function that will be called with current and past
	 * 		value of the port when it changes.
	 * @returns {function} A function that can be used to remove the probe.
	 */
	network.prototype.probe = function(path, listener) {
		path = parseProcessPath(path);
		var processScope = this.$scope.$processes[path.process];
		if (!angular.isDefined(processScope)) {
			throw "$network: Invalid process to probe: " + path.process;
		}
		if (!angular.isDefined(processScope.$components[0].getInNamed(path.port))
		&& !angular.isDefined(processScope.$components[0].getOutNamed(path.port))) {
			throw "$network: Invalid port to probe `" + path.port + "` for process `" + path.process + "`";
		}
		return processScope.$watch(path.port, listener);
	};

	/**
	 * @ngdoc method
	 * @name AUTO.$network#import
	 * @methodOf AUTO.$network
	 *
	 * @description
	 * A way to import local scope values to a specific process input port in the
	 * network.
	 *
	 * Only non connected input ports in the network can be targetted by imports.
	 *
	 * @param {!Object} scope The scope form which to import values.
	 * @param {!Object|!string} importMap If called with an object, it should be a
	 * 		process port path string to scope property name string map. Otherwise
	 * 		it will be directly watched in the given scope.
	 * @returns {*} the network.
	 */
	network.prototype.import = function(scope, importMap) {
		if (!importMap || angular.equals({}, importMap)) return this;

		if (angular.isObject(importMap)) {
			var importMapString = '{';
			angular.forEach(importMap, function(scopeVar, path) {
				importMapString += "'" + path + "':" + scopeVar + ",";
			});
			if (importMapString.length == 1) return this;
			importMap = importMapString.substr(0, importMapString.length - 1) + '}';
		}

		var self = this;
		var cancelWatcher = scope.$watchCollection(importMap, function(map) {
			if (!angular.isObject(map)) return cancelWatcher();
			angular.forEach(map, function(scopeVar, path) {
				path = parseProcessPath(path);
				if (angular.isDefined(self.$scope.$connections[path.process+'.'+path.port])) {
					throw "$network: Importing in an already connected input port: " + path;
				}
				var processScope = self.$scope.$processes[path.process];
				if (processScope) {
					processScope[path.port] = scopeVar;
				}
			});
		});

		return this;
	};

	/**
	 * @ngdoc method
	 * @name AUTO.$network#export
	 * @methodOf AUTO.$network
	 *
	 * @description
	 * A way to export specific process output ports values to a local scope properties.
	 *
	 * @param {!Object} scope The scope to which export values.
	 * @param {!Object|!string} exportMap If called with an object, it should be a
	 * 		scope property name string to process port path string map. Otherwise
	 * 		it will be evalued in the given scope and converted to an object.
	 * @returns {*} the network.
	 */
	network.prototype.export = function(scope, exportMap) {
		if (!exportMap || angular.equals({}, exportMap)) return this;

		if (!angular.isObject(exportMap)) {
			exportMap = scope.$eval(exportMap);
		}

		var self = this;
		angular.forEach(exportMap, function(path, scopeVar) {
			path = parseProcessPath(path);
			var processScope = self.$scope.$processes[path.process];
			if (processScope && processScope.$components[0].getOutNamed(path.port)) {
				processScope.$watch(path.port, function(val) {
					scope[scopeVar] = val;
				});
			}
		});

		return this;
	};

	/**
	 * @ngdoc method
	 * @name AUTO.$network#empty
	 * @methodOf AUTO.$network
	 *
	 * @description
	 * Removes every process and connection from the network.
	 *
	 * @returns {*} the network.
	 */
	network.prototype.empty = function() {
		for (var to in this.$scope.$connections) {
			this.$scope.$connections[to].$destroy();
		}
		for (var name in this.$scope.$processes) {
			this.$scope.$processes[name].$destroy();
		}
		return this;
	};

	/**
	 * @ngdoc method
	 * @name AUTO.$network#graph
	 * @methodOf AUTO.$network
	 *
	 * @description
	 * A network can be described as a JSON object containing `processes` and
	 * `connections` like:
	 *
	 * ```
	 {
	 	"processes": {
	 		"Exclamate": { "component":"string-append" },
	 		"Shout": { "component":"string-uppercase" }
	 	},
	 	"connections": {
	 		"Shout.in": { "form": "Exclamate.out" },
	 		"Exclamate.second": { "data": "!" }
	 	}
	 }
	 * ```
	 *
	 * This method can set the network according to one such object or return
	 * the current network configuration. Loadind a graph in a network will substitute
	 * its current configuration.
	 *
	 * @param {Object=} graph The graph to load in the network. If not set, a
	 * 		serialization of the network will be returned.
	 * @returns {Object} The network if called with an argument. Otherwise the object
	 * 		serialization of the current network configuration.
	 */
	network.prototype.graph = function(graph) {
		if (arguments.length == 0) {
			graph = {};
			angular.forEach(this.$scope.$processes, function(pscope, pname) {
				graph.processes = (graph.processes || {})
				graph.processes[pname] = {
					component: pscope.$components[0].componentName
				};
			});
			angular.forEach(this.$scope.$connections, function(connection, to) {
				connection = angular.copy(connection);
				delete connection.$destroy;
				graph.connections = (graph.connections || {})
				graph.connections[to] = connection;
			});
			return graph;
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

		return this;
	};

	network.prototype.fbp = function(fbp) {
		if (arguments.length == 0) {
			return "IMPLEMENT ME";
		}
		if (typeof fbpParser == 'undefined') return this;
		return this.graph(fbpParser.parse(fbp));
	};

	var networkProvider = {
		$get: ['$rootScope', '$component', function($rootScope, $component) {
			return function(name, graph) {
				return new network($rootScope, $component, name, graph);
			};
		}]
	}

	return networkProvider;

	// A process path should have a format like `processName.portName`. This function
	// parses such strings and returns an object with `process` and `port` stirngs.
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

/**
 * @ngdoc directive
 * @name ngFlo.directive:floNetwork
 *
 * @description
 * The `floNetwork` directive allaws the declaration of {@link ngFlo.$network networks}
 * using the {@link ngFlo.$network#fbp FBP} domain-specific language in the DOM.
 *
 * With the use of
 * {@link ngFlo.$network#import import} and {@link ngFlo.$network#export export}
 * attributes, the network can be attached to the current scope.
 *
 * The FBP network itself can be specified as the element content text.
 * If an `src` attribute is specified, the network will be loaded from the specified url.
 *
 * @element ANY
 * @param {expression=} import {@link guide/expression Expression} to use as network
 * 		{@link ngFlo.$network#import import}.
 * @param {expression=} export {@link guide/expression Expression} to use as network
 * 		{@link ngFlo.$network#export export}.
 * @param {string=} src Url from which to load the network FBP source.
 * @param {string=} <text> The text inside the element will be interpreted as FBP.
 */
flo.directive('floNetwork', ['$network', '$http', '$sce', function($network, $http, $sce) {
	return {
		restrict: 'EA',
		compile: function(element, attr, transclusion) {
			var name = attr.floNetwork || attr.name || '',
			    imports = attr['import'],
			    exports = attr['export'],
			    fbp = element.text();
			element.replaceWith(angular.element("<!-- flo-network: \n" + fbp + "\n -->"));

			var net;
			return function(scope, element, attrs) {
				if (attrs.src) {
					scope.$watch($sce.parseAsResourceUrl(attrs.src), function(src) {
						$http.get(src).success(function(response) {
							if (!net) {
								net = $network(name);
							}
							populateNetwork(scope, net, response, imports, exports);
						});
						scope.$emit('$floNetworkRequested');
					});
				} else if (fbp) {
					net = $network(name);
					populateNetwork(scope, net, fbp, imports, exports);
				}
			}
		}
	};

	function populateNetwork(scope, net, fbp, imports, exports) {
		net.fbp(fbp);
		if (imports) {
			net.import(scope, imports);
		}
		if (exports) {
			net.export(scope, exports);
		}
		scope.$emit('$floNetworkLoaded');
		return net;
	}
}]);

var fbpParser;
angular.element(document).find('head').prepend('<style type="text/css">@charset "UTF-8";flo-network,[flo\\:network],[flo-network],[data-flo-network],[x-flo-network],.flo-network,.x-flo-network{display:none !important;}</style>');
;fbpParser = (function(){
  /*
   * Generated by PEG.js 0.7.0.
   *
   * http://pegjs.majda.cz/
   */
  
  function quote(s) {
    /*
     * ECMA-262, 5th ed., 7.8.4: All characters may appear literally in a
     * string literal except for the closing quote character, backslash,
     * carriage return, line separator, paragraph separator, and line feed.
     * Any character may appear in the form of an escape sequence.
     *
     * For portability, we also escape escape all control and non-ASCII
     * characters. Note that "\0" and "\v" escape sequences are not used
     * because JSHint does not like the first and IE the second.
     */
     return '"' + s
      .replace(/\\/g, '\\\\')  // backslash
      .replace(/"/g, '\\"')    // closing quote character
      .replace(/\x08/g, '\\b') // backspace
      .replace(/\t/g, '\\t')   // horizontal tab
      .replace(/\n/g, '\\n')   // line feed
      .replace(/\f/g, '\\f')   // form feed
      .replace(/\r/g, '\\r')   // carriage return
      .replace(/[\x00-\x07\x0B\x0E-\x1F\x80-\uFFFF]/g, escape)
      + '"';
  }
  
  var result = {
    /*
     * Parses the input with a generated parser. If the parsing is successfull,
     * returns a value explicitly or implicitly specified by the grammar from
     * which the parser was generated (see |PEG.buildParser|). If the parsing is
     * unsuccessful, throws |PEG.parser.SyntaxError| describing the error.
     */
    parse: function(input, startRule) {
      var parseFunctions = {
        "start": parse_start,
        "line": parse_line,
        "LineTerminator": parse_LineTerminator,
        "comment": parse_comment,
        "connection": parse_connection,
        "bridge": parse_bridge,
        "leftlet": parse_leftlet,
        "iip": parse_iip,
        "rightlet": parse_rightlet,
        "node": parse_node,
        "component": parse_component,
        "compMeta": parse_compMeta,
        "port": parse_port,
        "anychar": parse_anychar,
        "_": parse__,
        "__": parse___
      };
      
      if (startRule !== undefined) {
        if (parseFunctions[startRule] === undefined) {
          throw new Error("Invalid rule name: " + quote(startRule) + ".");
        }
      } else {
        startRule = "start";
      }
      
      var pos = 0;
      var reportFailures = 0;
      var rightmostFailuresPos = 0;
      var rightmostFailuresExpected = [];
      
      function padLeft(input, padding, length) {
        var result = input;
        
        var padLength = length - input.length;
        for (var i = 0; i < padLength; i++) {
          result = padding + result;
        }
        
        return result;
      }
      
      function escape(ch) {
        var charCode = ch.charCodeAt(0);
        var escapeChar;
        var length;
        
        if (charCode <= 0xFF) {
          escapeChar = 'x';
          length = 2;
        } else {
          escapeChar = 'u';
          length = 4;
        }
        
        return '\\' + escapeChar + padLeft(charCode.toString(16).toUpperCase(), '0', length);
      }
      
      function matchFailed(failure) {
        if (pos < rightmostFailuresPos) {
          return;
        }
        
        if (pos > rightmostFailuresPos) {
          rightmostFailuresPos = pos;
          rightmostFailuresExpected = [];
        }
        
        rightmostFailuresExpected.push(failure);
      }
      
      function parse_start() {
        var result0, result1;
        var pos0;
        
        pos0 = pos;
        result0 = [];
        result1 = parse_line();
        while (result1 !== null) {
          result0.push(result1);
          result1 = parse_line();
        }
        if (result0 !== null) {
          result0 = (function(offset) { return parser.getResult();  })(pos0);
        }
        if (result0 === null) {
          pos = pos0;
        }
        return result0;
      }
      
      function parse_line() {
        var result0, result1, result2, result3;
        var pos0, pos1;
        
        pos0 = pos;
        result0 = parse_comment();
        if (result0 !== null) {
          if (/^[\n\r\u2028\u2029]/.test(input.charAt(pos))) {
            result1 = input.charAt(pos);
            pos++;
          } else {
            result1 = null;
            if (reportFailures === 0) {
              matchFailed("[\\n\\r\\u2028\\u2029]");
            }
          }
          result1 = result1 !== null ? result1 : "";
          if (result1 !== null) {
            result0 = [result0, result1];
          } else {
            result0 = null;
            pos = pos0;
          }
        } else {
          result0 = null;
          pos = pos0;
        }
        if (result0 === null) {
          pos0 = pos;
          result0 = parse__();
          if (result0 !== null) {
            if (/^[\n\r\u2028\u2029]/.test(input.charAt(pos))) {
              result1 = input.charAt(pos);
              pos++;
            } else {
              result1 = null;
              if (reportFailures === 0) {
                matchFailed("[\\n\\r\\u2028\\u2029]");
              }
            }
            if (result1 !== null) {
              result0 = [result0, result1];
            } else {
              result0 = null;
              pos = pos0;
            }
          } else {
            result0 = null;
            pos = pos0;
          }
          if (result0 === null) {
            pos0 = pos;
            pos1 = pos;
            result0 = parse__();
            if (result0 !== null) {
              result1 = parse_connection();
              if (result1 !== null) {
                result2 = parse__();
                if (result2 !== null) {
                  result3 = parse_LineTerminator();
                  result3 = result3 !== null ? result3 : "";
                  if (result3 !== null) {
                    result0 = [result0, result1, result2, result3];
                  } else {
                    result0 = null;
                    pos = pos1;
                  }
                } else {
                  result0 = null;
                  pos = pos1;
                }
              } else {
                result0 = null;
                pos = pos1;
              }
            } else {
              result0 = null;
              pos = pos1;
            }
            if (result0 !== null) {
              result0 = (function(offset, edges) {return parser.registerEdges(edges);})(pos0, result0[1]);
            }
            if (result0 === null) {
              pos = pos0;
            }
          }
        }
        return result0;
      }
      
      function parse_LineTerminator() {
        var result0, result1, result2, result3, result4;
        var pos0;
        
        pos0 = pos;
        result0 = parse__();
        if (result0 !== null) {
          if (input.charCodeAt(pos) === 44) {
            result1 = ",";
            pos++;
          } else {
            result1 = null;
            if (reportFailures === 0) {
              matchFailed("\",\"");
            }
          }
          result1 = result1 !== null ? result1 : "";
          if (result1 !== null) {
            result2 = parse_comment();
            result2 = result2 !== null ? result2 : "";
            if (result2 !== null) {
              if (/^[\n\r\u2028\u2029]/.test(input.charAt(pos))) {
                result3 = input.charAt(pos);
                pos++;
              } else {
                result3 = null;
                if (reportFailures === 0) {
                  matchFailed("[\\n\\r\\u2028\\u2029]");
                }
              }
              result3 = result3 !== null ? result3 : "";
              if (result3 !== null) {
                result4 = parse__();
                if (result4 !== null) {
                  result0 = [result0, result1, result2, result3, result4];
                } else {
                  result0 = null;
                  pos = pos0;
                }
              } else {
                result0 = null;
                pos = pos0;
              }
            } else {
              result0 = null;
              pos = pos0;
            }
          } else {
            result0 = null;
            pos = pos0;
          }
        } else {
          result0 = null;
          pos = pos0;
        }
        return result0;
      }
      
      function parse_comment() {
        var result0, result1, result2, result3;
        var pos0;
        
        pos0 = pos;
        result0 = parse__();
        if (result0 !== null) {
          if (input.charCodeAt(pos) === 35) {
            result1 = "#";
            pos++;
          } else {
            result1 = null;
            if (reportFailures === 0) {
              matchFailed("\"#\"");
            }
          }
          if (result1 !== null) {
            result2 = [];
            result3 = parse_anychar();
            while (result3 !== null) {
              result2.push(result3);
              result3 = parse_anychar();
            }
            if (result2 !== null) {
              result0 = [result0, result1, result2];
            } else {
              result0 = null;
              pos = pos0;
            }
          } else {
            result0 = null;
            pos = pos0;
          }
        } else {
          result0 = null;
          pos = pos0;
        }
        return result0;
      }
      
      function parse_connection() {
        var result0, result1, result2, result3, result4;
        var pos0, pos1;
        
        pos0 = pos;
        pos1 = pos;
        result0 = parse_bridge();
        if (result0 !== null) {
          result1 = parse__();
          if (result1 !== null) {
            if (input.substr(pos, 2) === "->") {
              result2 = "->";
              pos += 2;
            } else {
              result2 = null;
              if (reportFailures === 0) {
                matchFailed("\"->\"");
              }
            }
            if (result2 !== null) {
              result3 = parse__();
              if (result3 !== null) {
                result4 = parse_connection();
                if (result4 !== null) {
                  result0 = [result0, result1, result2, result3, result4];
                } else {
                  result0 = null;
                  pos = pos1;
                }
              } else {
                result0 = null;
                pos = pos1;
              }
            } else {
              result0 = null;
              pos = pos1;
            }
          } else {
            result0 = null;
            pos = pos1;
          }
        } else {
          result0 = null;
          pos = pos1;
        }
        if (result0 !== null) {
          result0 = (function(offset, x, y) { return [x,y]; })(pos0, result0[0], result0[4]);
        }
        if (result0 === null) {
          pos = pos0;
        }
        if (result0 === null) {
          result0 = parse_bridge();
        }
        return result0;
      }
      
      function parse_bridge() {
        var result0, result1, result2, result3, result4;
        var pos0, pos1;
        
        pos0 = pos;
        pos1 = pos;
        result0 = parse_port();
        if (result0 !== null) {
          result1 = parse__();
          if (result1 !== null) {
            result2 = parse_node();
            if (result2 !== null) {
              result3 = parse__();
              if (result3 !== null) {
                result4 = parse_port();
                if (result4 !== null) {
                  result0 = [result0, result1, result2, result3, result4];
                } else {
                  result0 = null;
                  pos = pos1;
                }
              } else {
                result0 = null;
                pos = pos1;
              }
            } else {
              result0 = null;
              pos = pos1;
            }
          } else {
            result0 = null;
            pos = pos1;
          }
        } else {
          result0 = null;
          pos = pos1;
        }
        if (result0 !== null) {
          result0 = (function(offset, x, proc, y) { return [proc+'.'+x,{"from":proc+'.'+y}]; })(pos0, result0[0], result0[2], result0[4]);
        }
        if (result0 === null) {
          pos = pos0;
        }
        if (result0 === null) {
          result0 = parse_rightlet();
          if (result0 === null) {
            result0 = parse_leftlet();
            if (result0 === null) {
              result0 = parse_iip();
            }
          }
        }
        return result0;
      }
      
      function parse_leftlet() {
        var result0, result1, result2;
        var pos0, pos1;
        
        pos0 = pos;
        pos1 = pos;
        result0 = parse_node();
        if (result0 !== null) {
          result1 = parse__();
          if (result1 !== null) {
            result2 = parse_port();
            if (result2 !== null) {
              result0 = [result0, result1, result2];
            } else {
              result0 = null;
              pos = pos1;
            }
          } else {
            result0 = null;
            pos = pos1;
          }
        } else {
          result0 = null;
          pos = pos1;
        }
        if (result0 !== null) {
          result0 = (function(offset, proc, port) { return {"from":proc+'.'+port} })(pos0, result0[0], result0[2]);
        }
        if (result0 === null) {
          pos = pos0;
        }
        return result0;
      }
      
      function parse_iip() {
        var result0, result1, result2;
        var pos0, pos1;
        
        pos0 = pos;
        pos1 = pos;
        if (input.charCodeAt(pos) === 39) {
          result0 = "'";
          pos++;
        } else {
          result0 = null;
          if (reportFailures === 0) {
            matchFailed("\"'\"");
          }
        }
        if (result0 !== null) {
          result1 = [];
          result2 = parse_anychar();
          while (result2 !== null) {
            result1.push(result2);
            result2 = parse_anychar();
          }
          if (result1 !== null) {
            if (input.charCodeAt(pos) === 39) {
              result2 = "'";
              pos++;
            } else {
              result2 = null;
              if (reportFailures === 0) {
                matchFailed("\"'\"");
              }
            }
            if (result2 !== null) {
              result0 = [result0, result1, result2];
            } else {
              result0 = null;
              pos = pos1;
            }
          } else {
            result0 = null;
            pos = pos1;
          }
        } else {
          result0 = null;
          pos = pos1;
        }
        if (result0 !== null) {
          result0 = (function(offset, iip) { return {"data":iip.join("")} })(pos0, result0[1]);
        }
        if (result0 === null) {
          pos = pos0;
        }
        return result0;
      }
      
      function parse_rightlet() {
        var result0, result1, result2;
        var pos0, pos1;
        
        pos0 = pos;
        pos1 = pos;
        result0 = parse_port();
        if (result0 !== null) {
          result1 = parse__();
          if (result1 !== null) {
            result2 = parse_node();
            if (result2 !== null) {
              result0 = [result0, result1, result2];
            } else {
              result0 = null;
              pos = pos1;
            }
          } else {
            result0 = null;
            pos = pos1;
          }
        } else {
          result0 = null;
          pos = pos1;
        }
        if (result0 !== null) {
          result0 = (function(offset, port, proc) { return proc+'.'+port })(pos0, result0[0], result0[2]);
        }
        if (result0 === null) {
          pos = pos0;
        }
        return result0;
      }
      
      function parse_node() {
        var result0, result1;
        var pos0, pos1;
        
        pos0 = pos;
        pos1 = pos;
        if (/^[a-zA-Z0-9]/.test(input.charAt(pos))) {
          result1 = input.charAt(pos);
          pos++;
        } else {
          result1 = null;
          if (reportFailures === 0) {
            matchFailed("[a-zA-Z0-9]");
          }
        }
        if (result1 !== null) {
          result0 = [];
          while (result1 !== null) {
            result0.push(result1);
            if (/^[a-zA-Z0-9]/.test(input.charAt(pos))) {
              result1 = input.charAt(pos);
              pos++;
            } else {
              result1 = null;
              if (reportFailures === 0) {
                matchFailed("[a-zA-Z0-9]");
              }
            }
          }
        } else {
          result0 = null;
        }
        if (result0 !== null) {
          result1 = parse_component();
          result1 = result1 !== null ? result1 : "";
          if (result1 !== null) {
            result0 = [result0, result1];
          } else {
            result0 = null;
            pos = pos1;
          }
        } else {
          result0 = null;
          pos = pos1;
        }
        if (result0 !== null) {
          result0 = (function(offset, node, comp) { if(comp){parser.addNode(node.join(""),comp);}; return node.join("")})(pos0, result0[0], result0[1]);
        }
        if (result0 === null) {
          pos = pos0;
        }
        return result0;
      }
      
      function parse_component() {
        var result0, result1, result2, result3;
        var pos0, pos1;
        
        pos0 = pos;
        pos1 = pos;
        if (input.charCodeAt(pos) === 40) {
          result0 = "(";
          pos++;
        } else {
          result0 = null;
          if (reportFailures === 0) {
            matchFailed("\"(\"");
          }
        }
        if (result0 !== null) {
          if (/^[a-zA-Z\/\-]/.test(input.charAt(pos))) {
            result2 = input.charAt(pos);
            pos++;
          } else {
            result2 = null;
            if (reportFailures === 0) {
              matchFailed("[a-zA-Z\\/\\-]");
            }
          }
          if (result2 !== null) {
            result1 = [];
            while (result2 !== null) {
              result1.push(result2);
              if (/^[a-zA-Z\/\-]/.test(input.charAt(pos))) {
                result2 = input.charAt(pos);
                pos++;
              } else {
                result2 = null;
                if (reportFailures === 0) {
                  matchFailed("[a-zA-Z\\/\\-]");
                }
              }
            }
          } else {
            result1 = null;
          }
          result1 = result1 !== null ? result1 : "";
          if (result1 !== null) {
            result2 = parse_compMeta();
            result2 = result2 !== null ? result2 : "";
            if (result2 !== null) {
              if (input.charCodeAt(pos) === 41) {
                result3 = ")";
                pos++;
              } else {
                result3 = null;
                if (reportFailures === 0) {
                  matchFailed("\")\"");
                }
              }
              if (result3 !== null) {
                result0 = [result0, result1, result2, result3];
              } else {
                result0 = null;
                pos = pos1;
              }
            } else {
              result0 = null;
              pos = pos1;
            }
          } else {
            result0 = null;
            pos = pos1;
          }
        } else {
          result0 = null;
          pos = pos1;
        }
        if (result0 !== null) {
          result0 = (function(offset, comp, meta) { var o = {}; comp ? o.comp = comp.join("") : o.comp = ''; meta ? o.meta = meta.join("").split(',') : null; return o; })(pos0, result0[1], result0[2]);
        }
        if (result0 === null) {
          pos = pos0;
        }
        return result0;
      }
      
      function parse_compMeta() {
        var result0, result1, result2;
        var pos0, pos1;
        
        pos0 = pos;
        pos1 = pos;
        if (input.charCodeAt(pos) === 58) {
          result0 = ":";
          pos++;
        } else {
          result0 = null;
          if (reportFailures === 0) {
            matchFailed("\":\"");
          }
        }
        if (result0 !== null) {
          if (/^[a-zA-Z\/]/.test(input.charAt(pos))) {
            result2 = input.charAt(pos);
            pos++;
          } else {
            result2 = null;
            if (reportFailures === 0) {
              matchFailed("[a-zA-Z\\/]");
            }
          }
          if (result2 !== null) {
            result1 = [];
            while (result2 !== null) {
              result1.push(result2);
              if (/^[a-zA-Z\/]/.test(input.charAt(pos))) {
                result2 = input.charAt(pos);
                pos++;
              } else {
                result2 = null;
                if (reportFailures === 0) {
                  matchFailed("[a-zA-Z\\/]");
                }
              }
            }
          } else {
            result1 = null;
          }
          if (result1 !== null) {
            result0 = [result0, result1];
          } else {
            result0 = null;
            pos = pos1;
          }
        } else {
          result0 = null;
          pos = pos1;
        }
        if (result0 !== null) {
          result0 = (function(offset, meta) {return meta})(pos0, result0[1]);
        }
        if (result0 === null) {
          pos = pos0;
        }
        return result0;
      }
      
      function parse_port() {
        var result0, result1, result2;
        var pos0, pos1;
        
        pos0 = pos;
        pos1 = pos;
        if (/^[A-Z]/.test(input.charAt(pos))) {
          result0 = input.charAt(pos);
          pos++;
        } else {
          result0 = null;
          if (reportFailures === 0) {
            matchFailed("[A-Z]");
          }
        }
        if (result0 !== null) {
          result1 = [];
          if (/^[A-Z0-9]/.test(input.charAt(pos))) {
            result2 = input.charAt(pos);
            pos++;
          } else {
            result2 = null;
            if (reportFailures === 0) {
              matchFailed("[A-Z0-9]");
            }
          }
          while (result2 !== null) {
            result1.push(result2);
            if (/^[A-Z0-9]/.test(input.charAt(pos))) {
              result2 = input.charAt(pos);
              pos++;
            } else {
              result2 = null;
              if (reportFailures === 0) {
                matchFailed("[A-Z0-9]");
              }
            }
          }
          if (result1 !== null) {
            result2 = parse___();
            if (result2 !== null) {
              result0 = [result0, result1, result2];
            } else {
              result0 = null;
              pos = pos1;
            }
          } else {
            result0 = null;
            pos = pos1;
          }
        } else {
          result0 = null;
          pos = pos1;
        }
        if (result0 !== null) {
          result0 = (function(offset, portnamestart, portnamerest) {return (portnamestart[0]+portnamerest.join("")).toLowerCase()})(pos0, result0[0], result0[1]);
        }
        if (result0 === null) {
          pos = pos0;
        }
        return result0;
      }
      
      function parse_anychar() {
        var result0;
        
        if (/^[a-zA-Z0-9 .,#:{}@+?!^=()_\-$*\/\\[\]{}"&`%|]/.test(input.charAt(pos))) {
          result0 = input.charAt(pos);
          pos++;
        } else {
          result0 = null;
          if (reportFailures === 0) {
            matchFailed("[a-zA-Z0-9 .,#:{}@+?!^=()_\\-$*\\/\\\\[\\]{}\"&`%|]");
          }
        }
        return result0;
      }
      
      function parse__() {
        var result0, result1;
        
        result0 = [];
        if (/^[" "\t]/.test(input.charAt(pos))) {
          result1 = input.charAt(pos);
          pos++;
        } else {
          result1 = null;
          if (reportFailures === 0) {
            matchFailed("[\" \"\\t]");
          }
        }
        while (result1 !== null) {
          result0.push(result1);
          if (/^[" "\t]/.test(input.charAt(pos))) {
            result1 = input.charAt(pos);
            pos++;
          } else {
            result1 = null;
            if (reportFailures === 0) {
              matchFailed("[\" \"\\t]");
            }
          }
        }
        result0 = result0 !== null ? result0 : "";
        return result0;
      }
      
      function parse___() {
        var result0, result1;
        
        if (/^[" "\t]/.test(input.charAt(pos))) {
          result1 = input.charAt(pos);
          pos++;
        } else {
          result1 = null;
          if (reportFailures === 0) {
            matchFailed("[\" \"\\t]");
          }
        }
        if (result1 !== null) {
          result0 = [];
          while (result1 !== null) {
            result0.push(result1);
            if (/^[" "\t]/.test(input.charAt(pos))) {
              result1 = input.charAt(pos);
              pos++;
            } else {
              result1 = null;
              if (reportFailures === 0) {
                matchFailed("[\" \"\\t]");
              }
            }
          }
        } else {
          result0 = null;
        }
        return result0;
      }
      
      
      function cleanupExpected(expected) {
        expected.sort();
        
        var lastExpected = null;
        var cleanExpected = [];
        for (var i = 0; i < expected.length; i++) {
          if (expected[i] !== lastExpected) {
            cleanExpected.push(expected[i]);
            lastExpected = expected[i];
          }
        }
        return cleanExpected;
      }
      
      function computeErrorPosition() {
        /*
         * The first idea was to use |String.split| to break the input up to the
         * error position along newlines and derive the line and column from
         * there. However IE's |split| implementation is so broken that it was
         * enough to prevent it.
         */
        
        var line = 1;
        var column = 1;
        var seenCR = false;
        
        for (var i = 0; i < Math.max(pos, rightmostFailuresPos); i++) {
          var ch = input.charAt(i);
          if (ch === "\n") {
            if (!seenCR) { line++; }
            column = 1;
            seenCR = false;
          } else if (ch === "\r" || ch === "\u2028" || ch === "\u2029") {
            line++;
            column = 1;
            seenCR = true;
          } else {
            column++;
            seenCR = false;
          }
        }
        
        return { line: line, column: column };
      }
      
      
        var parser, edges, nodes;
      
        parser = this;
      
        edges = parser.edges = [];
      
        nodes = {};
      
        parser.addNode = function (nodeName, comp) {
          if (!nodes[nodeName]) {
            nodes[nodeName] = {}
          }
          if (!!comp.comp) {
            nodes[nodeName].component = comp.comp;
          }
          if (!!comp.meta) {
            nodes[nodeName].metadata={routes:comp.meta};
          }
      
        }
      
        parser.getResult = function () {
          return {processes:nodes, connections:parser.processEdges()};
        }
      
        var flatten = function (array, isShallow) {
          var index = -1,
            length = array ? array.length : 0,
            result = [];
      
          while (++index < length) {
            var value = array[index];
      
            if (value instanceof Array) {
              Array.prototype.push.apply(result, isShallow ? value : flatten(value));
            }
            else {
              result.push(value);
            }
          }
          return result;
        }
      
        parser.registerEdges = function (edges) {
      
          edges.forEach(function (o, i) {
            parser.edges.push(o);
          });
        }
      
        parser.processEdges = function () {
          var flats, grouped;
          flats = flatten(parser.edges);
          grouped = {};
          var last;
          flats.forEach(function (o, i) {
            if (i % 2 !== 0) {
              grouped[o] = last;
              return;
            }
            last = o;
          });
          return grouped;
        }
      
      
      var result = parseFunctions[startRule]();
      
      /*
       * The parser is now in one of the following three states:
       *
       * 1. The parser successfully parsed the whole input.
       *
       *    - |result !== null|
       *    - |pos === input.length|
       *    - |rightmostFailuresExpected| may or may not contain something
       *
       * 2. The parser successfully parsed only a part of the input.
       *
       *    - |result !== null|
       *    - |pos < input.length|
       *    - |rightmostFailuresExpected| may or may not contain something
       *
       * 3. The parser did not successfully parse any part of the input.
       *
       *   - |result === null|
       *   - |pos === 0|
       *   - |rightmostFailuresExpected| contains at least one failure
       *
       * All code following this comment (including called functions) must
       * handle these states.
       */
      if (result === null || pos !== input.length) {
        var offset = Math.max(pos, rightmostFailuresPos);
        var found = offset < input.length ? input.charAt(offset) : null;
        var errorPosition = computeErrorPosition();
        
        throw new this.SyntaxError(
          cleanupExpected(rightmostFailuresExpected),
          found,
          offset,
          errorPosition.line,
          errorPosition.column
        );
      }
      
      return result;
    },
    
    /* Returns the parser source code. */
    toSource: function() { return this._source; }
  };
  
  /* Thrown when a parser encounters a syntax error. */
  
  result.SyntaxError = function(expected, found, offset, line, column) {
    function buildMessage(expected, found) {
      var expectedHumanized, foundHumanized;
      
      switch (expected.length) {
        case 0:
          expectedHumanized = "end of input";
          break;
        case 1:
          expectedHumanized = expected[0];
          break;
        default:
          expectedHumanized = expected.slice(0, expected.length - 1).join(", ")
            + " or "
            + expected[expected.length - 1];
      }
      
      foundHumanized = found ? quote(found) : "end of input";
      
      return "Expected " + expectedHumanized + " but " + foundHumanized + " found.";
    }
    
    this.name = "SyntaxError";
    this.expected = expected;
    this.found = found;
    this.message = buildMessage(expected, found);
    this.offset = offset;
    this.line = line;
    this.column = column;
  };
  
  result.SyntaxError.prototype = Error.prototype;
  
  return result;
})();})(angular, window, document);
var TYPE_ANY = 'all',
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
			 * @name ngFlo.$component
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
			return function(name, locals) {
				var componentSettings = null;

				if (angular.isString(name)) {
					componentSettings = components[name];
				} else if (angular.isFunction(name)) {
					componentSettings = {};
					componentSettings.transformer = name;
					componentSettings.ins = validateComponentPorts($injector.annotate(name));
					componentSettings.outs = validateComponentPorts(locals);
					locals = null;
				}

				if (!angular.isObject(componentSettings)) {
					throw "$component: No component '" + name + "' found.";
				}

				var transformer = componentSettings.transformer;
				if (angular.isFunction(componentSettings.compile)) {
					transformer = $injector.invoke(componentSettings.compile, componentSettings, locals);
					// TODO throw if transformer is not a function
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
		}

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

angular.element(document).find('head').prepend('<style type="text/css">@charset "UTF-8";flo-network,[flo\\:network],[flo-network],[data-flo-network],[x-flo-network],.flo-network,.x-flo-network{display:none !important;}</style>');

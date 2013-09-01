module.exports = function (grunt) {
  // load all grunt tasks
  require('matchdep').filterDev('grunt-*').forEach(grunt.loadNpmTasks);

  grunt.initConfig({
    karma: {
      unit: {
        configFile: 'karma.conf.js',
        singleRun: true
      }
    },
    concat: {
      options: {
        separator: ';',
        banner: '(function(angular, window, document, undefined) {"use strict";',
        footer: '})(angular, window, document);'
      },
      dist: {
        src: ['src/angular-flo.js'],
        dest: 'angular-flo.js',
      },
    },
    ngmin: {
      dist: {
        files: {
          'angular-flo.min.js': [
            'angular-flo.js'
          ]
        }
      }
    },
    uglify: {
      dist: {
        files: {
          'angular-flo.min.js': [
            'angular-flo.js'
          ]
        }
      }
    }
  });

  grunt.registerTask('test', [
    'karma'
  ]);

  grunt.registerTask('build', [
    'concat',
    'ngmin',
    'uglify'
  ]);
};

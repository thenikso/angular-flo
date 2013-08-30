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
    'ngmin',
    'uglify'
  ]);
};

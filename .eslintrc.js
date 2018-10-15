module.exports = {
	"env": {
		"browser": true,
		"commonjs": true,
		"es6": true
	},
	"extends": "eslint:recommended",
	"globals": {
		"L": true,
		"DBHelper": true
	},
	"rules": {
		"indent": [
			"error",
			2
		],
		"no-console": [
			"error",
			{ allow: ["log", "error"] }
		],
		"linebreak-style": 0,
		"quotes": [
			"error",
			"single"
		],
		"semi": [
			"error",
			"always"
		]
	},
	"parserOptions": {
		"ecmaVersion": 2017,
		"sourceType": "module"
	}
};
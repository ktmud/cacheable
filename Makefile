.PHONY: test coverage

test:
	@DEBUG= npm test

coverage:
	@DEBUG= istanbul cover ./node_modules/.bin/_mocha && open ./coverage/lcov-report/index.html

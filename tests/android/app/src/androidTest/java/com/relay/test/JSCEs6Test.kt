package com.relay.test

import android.content.Context
import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.test.platform.app.InstrumentationRegistry
import org.junit.Assert.*
import com.facebook.jsc.wrapper.JSContext
import org.junit.After
import org.junit.Before
import org.junit.Test
import org.junit.runner.RunWith
import kotlin.test.assertEquals
import kotlin.test.assertTrue
import kotlin.test.assertNotNull

/**
 * ES6 Feature Tests for JavaScriptCore
 * Verifies that JSC provides full native ES6 support without transpilation
 */
@RunWith(AndroidJUnit4::class)
class JSCEs6Test {
    private lateinit var context: Context
    private var jsContext: JSContext? = null
    
    @Before
    fun setup() {
        context = InstrumentationRegistry.getInstrumentation().targetContext
        val nativeContext = JSContext.create()
        jsContext = JSContext(nativeContext)
        assertNotNull(jsContext, "JSC context should be created")
    }
    
    @After
    fun cleanup() {
        jsContext = null
    }
    
    @Test
    fun testArrowFunctions() {
        val code = """
            const add = (a, b) => a + b;
            add(2, 3)
        """.trimIndent()
        val result = jsContext!!.evaluateScript(code, "arrow.js")
        assertEquals("5", result)
    }
    
    @Test
    fun testTemplateLiterals() {
        val code = """
            const name = 'World';
            `Hello ${'$'}{name}!`
        """.trimIndent()
        val result = jsContext!!.evaluateScript(code, "template.js")
        assertEquals("Hello World!", result)
    }
    
    @Test
    fun testDestructuring() {
        val code = """
            const obj = { a: 1, b: 2, c: 3 };
            const { a, c } = obj;
            a + c
        """.trimIndent()
        val result = jsContext!!.evaluateScript(code, "destructure.js")
        assertEquals("4", result)
    }
    
    @Test
    fun testArrayDestructuring() {
        val code = """
            const arr = [1, 2, 3, 4, 5];
            const [first, second, ...rest] = arr;
            first + second + rest.length
        """.trimIndent()
        val result = jsContext!!.evaluateScript(code, "array_destructure.js")
        assertEquals("6", result)
    }
    
    @Test
    fun testSpreadOperator() {
        val code = """
            const arr1 = [1, 2, 3];
            const arr2 = [...arr1, 4, 5];
            arr2.length
        """.trimIndent()
        val result = jsContext!!.evaluateScript(code, "spread.js")
        assertEquals("5", result)
    }
    
    @Test
    fun testObjectSpread() {
        val code = """
            const obj1 = { a: 1, b: 2 };
            const obj2 = { ...obj1, c: 3 };
            obj2.c
        """.trimIndent()
        val result = jsContext!!.evaluateScript(code, "object_spread.js")
        assertEquals("3", result)
    }
    
    @Test
    fun testClasses() {
        val code = """
            class Person {
                constructor(name) {
                    this.name = name;
                }
                greet() {
                    return `Hello, I'm ${'$'}{this.name}`;
                }
            }
            const person = new Person('Alice');
            person.greet()
        """.trimIndent()
        val result = jsContext!!.evaluateScript(code, "class.js")
        assertEquals("Hello, I'm Alice", result.toString())
    }
    
    @Test
    fun testClassInheritance() {
        val code = """
            class Animal {
                constructor(name) {
                    this.name = name;
                }
            }
            class Dog extends Animal {
                constructor(name, breed) {
                    super(name);
                    this.breed = breed;
                }
                describe() {
                    return `${'$'}{this.name} is a ${'$'}{this.breed}`;
                }
            }
            const dog = new Dog('Rex', 'German Shepherd');
            dog.describe()
        """.trimIndent()
        val result = jsContext!!.evaluateScript(code, "class_inheritance.js")
        assertEquals("Rex is a German Shepherd", result.toString())
    }
    
    @Test
    fun testPromises() {
        val code = """
            const p = Promise.resolve(42);
            typeof p === 'object' && p.constructor.name === 'Promise'
        """.trimIndent()
        val result = jsContext!!.evaluateScript(code, "promise.js")
        assertEquals("true", result)
    }
    
    @Test
    fun testAsyncFunctionDeclaration() {
        val code = """
            async function test() {
                return 42;
            }
            typeof test === 'function'
        """.trimIndent()
        val result = jsContext!!.evaluateScript(code, "async.js")
        assertEquals(true, result.toBoolean())
    }
    
    @Test
    fun testDefaultParameters() {
        val code = """
            function greet(name = 'Guest') {
                return `Hello, ${'$'}{name}!`;
            }
            greet()
        """.trimIndent()
        val result = jsContext!!.evaluateScript(code, "default_params.js")
        assertEquals("Hello, Guest!", result.toString())
    }
    
    @Test
    fun testRestParameters() {
        val code = """
            function sum(...numbers) {
                return numbers.reduce((a, b) => a + b, 0);
            }
            sum(1, 2, 3, 4, 5)
        """.trimIndent()
        val result = jsContext!!.evaluateScript(code, "rest_params.js")
        assertEquals("15", result)
    }
    
    @Test
    fun testObjectShorthand() {
        val code = """
            const name = 'Alice';
            const age = 30;
            const person = { name, age };
            person.name + '_' + person.age
        """.trimIndent()
        val result = jsContext!!.evaluateScript(code, "object_shorthand.js")
        assertEquals("Alice_30", result.toString())
    }
    
    @Test
    fun testComputedPropertyNames() {
        val code = """
            const key = 'dynamic';
            const obj = {
                [key]: 'value',
                [key + '2']: 'value2'
            };
            obj.dynamic + '_' + obj.dynamic2
        """.trimIndent()
        val result = jsContext!!.evaluateScript(code, "computed_props.js")
        assertEquals("value_value2", result.toString())
    }
    
    @Test
    fun testForOfLoop() {
        val code = """
            const arr = [1, 2, 3];
            let sum = 0;
            for (const num of arr) {
                sum += num;
            }
            sum
        """.trimIndent()
        val result = jsContext!!.evaluateScript(code, "for_of.js")
        assertEquals("6", result)
    }
    
    @Test
    fun testMapAndSet() {
        val code = """
            const map = new Map();
            map.set('key1', 'value1');
            map.set('key2', 'value2');
            const set = new Set([1, 2, 2, 3]);
            map.size + set.size
        """.trimIndent()
        val result = jsContext!!.evaluateScript(code, "map_set.js")
        assertEquals("5", result)
    }
    
    @Test
    fun testSymbols() {
        val code = """
            const sym1 = Symbol('test');
            const sym2 = Symbol('test');
            typeof sym1 === 'symbol' && sym1 !== sym2
        """.trimIndent()
        val result = jsContext!!.evaluateScript(code, "symbols.js")
        assertEquals("true", result)
    }
    
    @Test
    fun testArrayMethods() {
        val code = """
            const arr = [1, 2, 3, 4, 5];
            const doubled = arr.map(x => x * 2);
            const filtered = doubled.filter(x => x > 5);
            const found = filtered.find(x => x === 8);
            found
        """.trimIndent()
        val result = jsContext!!.evaluateScript(code, "array_methods.js")
        assertEquals("8", result)
    }
    
    @Test
    fun testObjectEntries() {
        val code = """
            const obj = { a: 1, b: 2, c: 3 };
            const entries = Object.entries(obj);
            entries.length
        """.trimIndent()
        val result = jsContext!!.evaluateScript(code, "object_entries.js")
        assertEquals("3", result)
    }
    
    @Test
    fun testStringMethods() {
        val code = """
            const str = 'hello world';
            str.includes('world') && str.startsWith('hello') && str.endsWith('world')
        """.trimIndent()
        val result = jsContext!!.evaluateScript(code, "string_methods.js")
        assertEquals("true", result)
    }
    
    @Test
    fun testArrayFindIndex() {
        val code = """
            const arr = [5, 12, 8, 130, 44];
            arr.findIndex(x => x > 10)
        """.trimIndent()
        val result = jsContext!!.evaluateScript(code, "array_find_index.js")
        assertEquals("1", result)
    }
    
    @Test
    fun testExponentiationOperator() {
        val code = """
            const result = 2 ** 10;
            result
        """.trimIndent()
        val result = jsContext!!.evaluateScript(code, "exponentiation.js")
        assertEquals("1024", result)
    }
    
    @Test
    fun testBlockScopedVariables() {
        val code = """
            let x = 1;
            {
                let x = 2;
                const y = 3;
            }
            x
        """.trimIndent()
        val result = jsContext!!.evaluateScript(code, "block_scope.js")
        assertEquals("1", result)
    }
    
    @Test
    fun testComplexES6Combination() {
        val code = """
            class Calculator {
                constructor() {
                    this.operations = new Map();
                    this.operations.set('add', (a, b) => a + b);
                    this.operations.set('multiply', (a, b) => a * b);
                }
                
                calculate(op, ...numbers) {
                    const fn = this.operations.get(op);
                    return numbers.reduce(fn);
                }
            }
            
            const calc = new Calculator();
            const sum = calc.calculate('add', 1, 2, 3, 4);
            const product = calc.calculate('multiply', 2, 3, 4);
            sum + product
        """.trimIndent()
        val result = jsContext!!.evaluateScript(code, "complex_es6.js")
        assertEquals("34", result) // (1+2+3+4) + (2*3*4) = 10 + 24 = 34
    }
}

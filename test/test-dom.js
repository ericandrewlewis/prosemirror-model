const {schema, eq, doc, blockquote, pre, h1, h2, p, li, ol, ul, em, strong, code, a, a2, br, img, hr} = require("./build")
const ist = require("ist")
const {DOMParser, DOMSerializer} = require("../dist")

// declare global: window
let document = typeof window == "undefined" ? require("jsdom").jsdom() : window.document

const parser = DOMParser.fromSchema(schema)
const serializer = DOMSerializer.fromSchema(schema)

describe("DOMParser", () => {
  describe("parse", () => {
    function test(doc, dom) {
      return () => {
        let derivedDOM = document.createElement("div")
        derivedDOM.appendChild(serializer.serializeFragment(doc.content, {document}))
        let declaredDOM = document.createElement("div")
        declaredDOM.innerHTML = dom

        ist(derivedDOM.innerHTML, declaredDOM.innerHTML)
        ist(parser.parse(derivedDOM), doc, eq)
      }
    }

    it("can represent simple node",
       test(doc(p("hello")),
            "<p>hello</p>"))

    it("can represent a line break",
       test(doc(p("hi", br, "there")),
            "<p>hi<br/>there</p>"))

    it("can represent an image",
       test(doc(p("hi", img, "there")),
            '<p>hi<img src="data:image/gif;base64,R0lGODlhAQABAAAAACH5BAEKAAEALAAAAAABAAEAAAICTAEAOw==" alt="x"/>there</p>'))

    it("joins styles",
       test(doc(p("one", strong("two", em("three")), em("four"), "five")),
            "<p>one<strong>two</strong><em><strong>three</strong>four</em>five</p>"))

    it("can represent links",
       test(doc(p("a ", a("big ", a2("nested"), " link"))),
            "<p>a <a href=\"http://foo\">big </a><a href=\"http://bar\">nested</a><a href=\"http://foo\"> link</a></p>"))

    it("can represent and unordered list",
       test(doc(ul(li(p("one")), li(p("two")), li(p("three", strong("!")))), p("after")),
            "<ul><li><p>one</p></li><li><p>two</p></li><li><p>three<strong>!</strong></p></li></ul><p>after</p>"))

    it("can represent an ordered list",
       test(doc(ol(li(p("one")), li(p("two")), li(p("three", strong("!")))), p("after")),
            "<ol><li><p>one</p></li><li><p>two</p></li><li><p>three<strong>!</strong></p></li></ol><p>after</p>"))

    it("can represent a blockquote",
       test(doc(blockquote(p("hello"), p("bye"))),
            "<blockquote><p>hello</p><p>bye</p></blockquote>"))

    it("can represent a nested blockquote",
       test(doc(blockquote(blockquote(blockquote(p("he said"))), p("i said"))),
            "<blockquote><blockquote><blockquote><p>he said</p></blockquote></blockquote><p>i said</p></blockquote>"))

    it("can represent headings",
       test(doc(h1("one"), h2("two"), p("text")),
            "<h1>one</h1><h2>two</h2><p>text</p>"))

    it("can represent inline code",
       test(doc(p("text and ", code("code that is ", em("emphasized"), "..."))),
            "<p>text and <code>code that is </code><em><code>emphasized</code></em><code>...</code></p>"))

    it("can represent a code block",
       test(doc(blockquote(pre("some code")), p("and")),
            "<blockquote><pre><code>some code</code></pre></blockquote><p>and</p>"))

    function recover(html, doc) {
      return () => {
        let dom = document.createElement("div")
        dom.innerHTML = html
        ist(parser.parse(dom), doc, eq)
      }
    }

    it("can recover a list item",
       recover("<ol><p>Oh no</p></ol>",
               doc(ol(li(p("Oh no"))))))

    it("can turn divs into paragraphs",
       recover("<div>hi</div><div>bye</div>",
               doc(p("hi"), p("bye"))))

    it("interprets <i> and <b> as emphasis and strong",
       recover("<p><i>hello <b>there</b></i></p>",
               doc(p(em("hello ", strong("there"))))))

    it("wraps stray text in a paragraph",
       recover("hi",
               doc(p("hi"))))

    it("ignores an extra wrapping <div>",
       recover("<div><p>one</p><p>two</p></div>",
               doc(p("one"), p("two"))))

    it("ignores meaningless whitespace",
       recover(" <blockquote> <p>woo  \n  <em> hooo</em></p> </blockquote> ",
               doc(blockquote(p("woo", em(" hooo"))))))

    it("finds a valid place for invalid content",
       recover("<ul><li>hi</li><p>whoah</p><li>again</li></ul>",
               doc(ul(li(p("hi")), li(p("whoah")), li(p("again"))))))

    it("moves nodes up when they don't fit the current context",
       recover("<div>hello<hr/>bye</div>",
               doc(p("hello"), hr, p("bye"))))

    it("doesn't ignore whitespace-only text nodes",
       recover("<p><em>one</em> <strong>two</strong></p>",
               doc(p(em("one"), " ", strong("two")))))

    it("can handle stray tab characters",
       recover("<p> <b>&#09;</b></p>",
               doc(p())))

    it("normalizes random spaces",
       recover("<p><b>1 </b>  </p>",
               doc(p(strong("1")))))

    it("can parse an empty code block",
       recover("<pre></pre>",
               doc(pre())))

    it("preserves trailing space in a code block",
       recover("<pre>foo\n</pre>",
               doc(pre("foo\n"))))

    it("ignores <script> tags",
       recover("<p>hello<script>alert('x')</script>!</p>",
               doc(p("hello!"))))

    it("can handle a head/body input structure",
       recover("<head><title>T</title><meta charset='utf8'/></head><body>hi</body>",
               doc(p("hi"))))

    it("only applies a mark once",
       recover("<p>A <strong>big <strong>strong</strong> monster</strong>.</p>",
               doc(p("A ", strong("big strong monster"), "."))))

    it("interprets font-weight: bold as strong",
       recover("<p style='font-weight: bold'>Hello</p>",
               doc(p(strong("Hello")))))

    it("ignores unknown inline tags",
       recover("<p><u>a</u>bc</p>",
               doc(p("abc"))))

    function find(html, doc) {
      return () => {
        let dom = document.createElement("div")
        dom.innerHTML = html
        let tag = dom.querySelector("var"), prev = tag.previousSibling, next = tag.nextSibling, pos
        if (prev && next && prev.nodeType == 3 && next.nodeType == 3) {
          pos = {node: prev, offset: prev.nodeValue.length}
          prev.nodeValue += next.nodeValue
          next.parentNode.removeChild(next)
        } else {
          pos = {node: tag.parentNode, offset: Array.prototype.indexOf.call(tag.parentNode.childNodes, tag)}
        }
        tag.parentNode.removeChild(tag)
        let result = parser.parse(dom, {
          findPositions: [pos]
        })
        ist(result, doc, eq)
        ist(pos.pos, doc.tag.a)
      }
    }

    it("can find a position at the start of a paragraph",
       find("<p><var></var>hello</p>",
            doc(p("<a>hello"))))

    it("can find a position at the end of a paragraph",
       find("<p>hello<var></var></p>",
            doc(p("hello<a>"))))

    it("can find a position inside text",
       find("<p>hel<var></var>lo</p>",
            doc(p("hel<a>lo"))))

    it("can find a position inside an ignored node",
       find("<p>hi</p><object><var></var>foo</object><p>ok</p>",
            doc(p("hi"), "<a>", p("ok"))))

    it("can find a position between nodes",
       find("<ul><li>foo</li><var></var><li>bar</li></ul>",
            doc(ul(li(p("foo")), "<a>", li(p("bar"))))))

    it("can find a position at the start of the document",
       find("<var></var><p>hi</p>",
            doc("<a>", p("hi"))))

    it("can find a position at the end of the document",
       find("<p>hi</p><var></var>",
            doc(p("hi"), "<a>")))
  })

  describe("parseInContext", () => {
    function test(doc, html, openLeft, slice) {
      return () => {
        let dom = document.createElement("div")
        dom.innerHTML = html
        let insert = doc.tag.a, $insert = doc.resolve(insert)
        for (let d = $insert.depth; d > 0 && insert == $insert.start(d) && $insert.end(d) == $insert.after(d + 1); d--) insert--
        let result = parser.parseInContext(doc.resolve(insert), dom, {openLeft})
        let sliceContent = slice.content, sliceEnd = sliceContent.size
        while (sliceContent.lastChild && !sliceContent.lastChild.isLeaf) { sliceEnd--; sliceContent = sliceContent.lastChild.content }
        let expected = slice.slice(slice.tag.a, sliceEnd)
        ist(result, expected, eq)
      }
    }

    it("can place a list item in a list",
       test(doc(ul(li(p("foo")), "<a>")),
            "<li>bar</li>", 0,
            ul("<a>", li(p("bar")))))

    it("can move a list item out of a list item",
       test(doc(ul(li(p("foo<a>")))),
            "<li>bar</li>", 0,
            ul("<a>", li(p("bar")))))

    it("can insert text after text",
       test(doc(p("foo<a>")),
            "<h1>bar</h1>", 1,
            p("<a>bar")))

    it("can organize messy input",
       test(doc(p("foo<a>")),
            "<p>a</p>b<li>c</li>", 0,
            doc("<a>", p("a"), p("b"), ol(li(p("c"))))))

    it("preserves openLeft",
       test(doc(p("foo<a>")),
            "<p>hello</p><p>there</p>", 1,
            doc(p("<a>hello"), p("there"))))

    it("preserves node type when adding to an empty node",
       test(doc(p("<a>")),
            "<h1>bar</h1>", 1,
            doc("<a>", h1("bar"))))

    it("preserves marks",
       test(doc(pre("<a>")),
            "<p>foo<strong>bar</strong></p>", 1,
            doc("<a>", p("foo", strong("bar")))))

    it("does the right thing for a pasted list",
       test(doc(p("<a>")),
            "<ol><li><p>foo</p></li><li><p>bar</p></li></ol>", 3,
            doc("<a>", ol(li(p("foo")), li(p("bar"))))))

    it("joins open list nodes onto the context list",
       test(doc(ol(li(p("x<a>")))),
            "<ol><li><p>foo</p></li><li><p>bar</p></li></ol>", 3,
            doc(ol(li(p("<a>foo")), li(p("bar"))))))
  })
})

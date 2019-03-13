const defaultMessages = {
	contradiction: "I am abroad.",
	trueFalseQuestion: {
		noAnswer: "maybe."
	},
	whoQuestion: {
		noAnswer: "I don't know."
	},
	whatQuestion: {
		noAnswer: "I don't know."
	}
}

const questionTypes = {
	trueFalse: ["do", "does"],
	who: "who",
	what: "what"
}

const negatingWords = ["don't", "doesn't", "nobody"];

const allEncompassingWords = ["everybody", "nobody"];

const useDo = ["I", "you"];

const wordRegex = /([^a-zA-Z]*$)|(^[^a-zA-Z]*)/g;

const infinitiveRegex = /s$/

Array.prototype.filterObject = function(query) {
	return this.filter(function(element) {
		let attributes = Object.keys(query);
		for (let attribute of attributes) {
			if (!compare(query[attribute], element[attribute], element)) {
				return false;
			}
		}
		return true;
	})
}
// Correctly formats the answer by removing anything thats null and running toString() on all objects.
function format(...args) {
	return args.filter(arg => arg !== null).map(arg => arg.toString()).join(" ") + ".";
}

function duplicate(array) {
	return array.slice(0);
}

// creates an english compliant list (with or without comma after final item.)
function makeList(elements, comma) {
	if (elements.length == 1) {
		return elements[0];
	}
	return elements.slice(0, elements.length - 1).join(", ") + (comma === true ? ", and " : " and ") + elements[elements.length - 1];
}

class WordTokenizer {
	static tokenize(sentence) {
		return sentence.split(" ").map((word) => Word.parse(word.replace(wordRegex, "")));
	}
}

class Sentence {
	static parse(raw) {
		if (raw.endsWith("?")) { // is a question
			return Question.parse(raw);
		} else if (raw.endsWith(".")) { // is a statement
			return Statement.parse(raw);
		} else if (raw.endsWith("!")) { // is final statement
			return EndStatement.parse(raw);
		}
	}
}

class Statement extends Sentence {
	static parse(raw) {
		let statement = new Statement();
		statement.type = "statement";
		statement.raw = raw;
		let words = WordTokenizer.tokenize(raw);
		statement.words = duplicate(words);
		let isNegative = false;
		let subject = words.shift();
		statement.subject = Subject.parse(subject);
		statement.isAllEncompassing = allEncompassingWords.includes(subject.word);
		if (subject.isNegative) {
			isNegative = true;
		} else if (words[0].isNegative) {
			isNegative = true;
			words.shift();
		}
		statement.isNegative = isNegative;
		statement.predicate = Verb.parse(words.shift());
		if (words.length > 0) { // if there is an object, set the object.
			statement.object = WordObject.parse(words);
		} else {
			statement.object = null;
		}
		return statement;
	}
}

class Question extends Sentence {
	static parse(raw) {
		let question = new Question();
		question.type = "question";
		question.raw = raw;
		let words = WordTokenizer.tokenize(raw);
		let questionType;
		question.words = duplicate(words);
		if (questionTypes.trueFalse.includes(words[0].word)) {
			questionType = "trueFalse";
			words.shift();
		} else if (words[0].word === questionTypes.who) {
			questionType = "who";
			words.shift();
		} else if (words[0].word === questionTypes.what) {
			questionType = "what"
			words.shift();
			words.shift(); // remove do/does, we don't need it because the subject parser detects it.
		}
		question.questionType = questionType;
		if (questionType == "trueFalse") {
			question.subject = Subject.parse(words.shift());
			question.predicate = Verb.parse(words.shift());
		} else if (questionType == "who") {
			question.predicate = Verb.parse(words.shift());
		} else if (questionType == "what") {
			question.subject = Subject.parse(words.shift());
		}
		if (questionType == "trueFalse" || questionType == "who") {
			if (words.length > 0) {
				question.object = WordObject.parse(words);
			} else {
				question.object = null;
			}
		}
		return question;
	}

}

class EndStatement extends Statement {
	static parse(raw) {
		let endStatement = new EndStatement();
		endStatement.type = "endstatement";
		endStatement.raw = raw;
		return endStatement;
	}
}

class Word {
	static parse(word) {
		let w = new Word();
		w.word = word;
		w.isNegative = negatingWords.includes(word);
		return w;
	}
	equals(other) {
		return this.word === other.word;
	}
	toString() {
		return this.word;
	}
}

class Verb extends Word {
	static parse(word) {
		let v = new Verb();
		v.word = word.word;
		v.isNegative = false;
		v.infinitive = word.word.replace(infinitiveRegex, "");
		return v;
	}
	equals(other) {
		return this.infinitive === other.infinitive;
	}
	conjugate(subject, isNegative) {
		if (subject instanceof Array) {
			if (subject.length == 1) return this.conjugate(subject[0], isNegative);
			return this.infinitive;
		} else {
			return subject.useDo || isNegative ? this.infinitive : this.infinitive + "s";
		}
	}
}

class WordObject extends Word {
	static parse(words) {
		let o = new WordObject();
		let word = words.map(w => w.word).join(" ");
		o.word = word;
		o.isNegative = false;
		return o;
	}
}

class Subject extends Word {
	static parse(word) {
		let s = new Subject();
		s.word = word.word;
		s.isNegative = negatingWords.includes(word.word);
		s.useDo = useDo.includes(word.word);
		s.isAllEncompassing = allEncompassingWords.includes(word.word);
		return s;
	}
	agree(negative) {
		if (negative) {
			return this.useDo ? "don't" : "doesn't";
		} else {
			return this.useDo ? "do" : "does";
		}
	}
	equals(other) {
		return this.word === other.word || other.isAllEncompassing || this.isAllEncompassing;
	}
}

function compare(ask, got, element) {
	if (typeof ask === "string") {
		return ask === got;
	} else if (ask instanceof Function) {
		return ask(got, element);
	} else if (ask instanceof Object && got instanceof Object) {
		return ask.equals(got);
	} else if (ask === null || got === null) {
		return ask === got;
	} else {
		throw new Error("Unimplemented for " + ask + " and " + got);
	}
}

// match if have somebody and has the same person or everybody/nobody
function hasContradiction(sentences, sentence) {
	let filtered = sentences.filterObject({
		type: "statement",
		subject: sentence.subject,
		predicate: sentence.predicate,
		object: sentence.object
	});
	for (let match of filtered) {
		if (match.isNegative ^ sentence.isNegative) {
			return true;
		}
	}
	return false;
}

function transformSubject(subject) {
	let newSubject = Subject.parse(subject);
	if (newSubject.word == "I") {
		newSubject.word = "you";
	} else if (newSubject.word == "you") {
		newSubject.word = "I";
	}
	return newSubject;
}

function answerTrueFalse(question, sentences) {
	let filtered = sentences.filterObject({
		type: "statement",
		subject: question.subject,
		predicate: question.predicate,
		object: question.object
	});
	if (filtered.length == 0) {
		return defaultMessages.trueFalseQuestion.noAnswer;
	}
	let answer = filtered.pop();
	if (answer.isNegative) {
		return format("no,", transformSubject(question.subject), question.subject.agree(true), question.predicate.conjugate(question.subject, true), question.object);
	} else {
		return format("yes,", transformSubject(question.subject), question.predicate.conjugate(question.subject, false), question.object);
	}
}

function answerWho(question, sentences) {
	let seen = [];
	let filtered = sentences.filterObject({
		type: "statement",
		predicate: question.predicate,
		object: question.object,
		isNegative: function(negative, element) {
			if (element.isAllEncompassing) return true;
			return !negative;
		}
	})
	if (filtered.length == 0) { // ¯\_(ツ)_/¯
		return defaultMessages.whoQuestion.noAnswer;
	}
	for (let statement of filtered) {
		if (statement.subject.word == "nobody") { 
			return format("nobody", question.predicate.conjugate(statement.subject, false), question.object);
		} else if (statement.subject.word == "everybody") {
			return format("everybody", question.predicate.conjugate(statement.subject, false), question.object);
		}
	}
	let subjects = filtered.map(statement => transformSubject(statement.subject));
	return format(makeList(subjects, false), question.predicate.conjugate(subjects, false), question.object);
}

function answerWhat(question, sentences) {
	let subject = transformSubject(question.subject);
	let seen = [];
	let filtered = sentences.filterObject({
		type: "statement",
		subject: question.subject
	}).filter(statement => { // remove duplicate verb-object pairs
		if (seen.filterObject({verb: statement.predicate, object: statement.object}).length > 0) {
			return false;
		}
		seen.push({verb: statement.predicate, object: statement.object});
		return true;
	});

	if (filtered.length == 0) {
		return defaultMessages.whatQuestion.noAnswer;
	}

	return format(subject, makeList(filtered.map(statement => {
		let res = "";
		if (statement.isNegative) {
			res += subject.agree(true) + " ";
		}
		res += statement.predicate.conjugate(subject, statement.isNegative);
		if (statement.object !== null) {
			res += " " + statement.object;
		}
		return res;
	}), true)) ;
}

function ask(question, sentences) {
	if (question.questionType == "trueFalse") {
		return answerTrueFalse(question, sentences);
	} else if (question.questionType == "who") {
		return answerWho(question, sentences);
	} else if (question.questionType == "what") {
		return answerWhat(question, sentences);
	} else {
		throw new Error("Invalid question type!");
	}
}

function runDialogue(number) {
	print(`Dialogue #${number}:`);
	let sentences = [];
	let contradicts = false;
	while(true) {
		let sentence = Sentence.parse(gets());
		if (sentence.type == "question") {
			print(sentence.raw);
			if (contradicts) {
				print(defaultMessages.contradiction + "\n");
				continue;
			}
			print(ask(sentence, sentences) + "\n");
		} else if (sentence.type == "statement") {
			if (hasContradiction(sentences, sentence)) {
				contradicts = true;
			}
		}
		sentences.push(sentence);
		if (sentence.type == "endstatement") {
			print(sentence.raw);
			break;
		}
	}
	print() // extra newline
}

let dialogues = parseInt(gets(), 10);

for (let dialogueNumber = 1; dialogueNumber <= dialogues; dialogueNumber++) {
	runDialogue(dialogueNumber);
}

function ValidateChars(text){
  const arr = text.split("");
  arr.forEach(char => {
    if (!CharAllowed(char)){
      throw new Error(`The following character is not allowed: ${char}`);
    }
  });
}

function CharAllowed(char) {
  const re = /[ A-Z a-z 0-9 . , ; : ' " ( ) & @ # % / ! ? * - = ½ \u00a9 \u00ae \u2000-\u3300 \ud83c \ud000-\udfff \ud83e \ud000-\udfff]/;
  const allowed = re.test(char);
  return allowed;
}

function CharsAllowed(str) {
  const re = /^[ A-Z a-z 0-9 . , ; : ' " ( ) & @ # % / ! ? * - = ½ \u00a9 \u00ae \u2000-\u3300 \ud83c \ud000-\udfff \ud83e \ud000-\udfff]+$/;
  const allowed = re.test(str);
  return allowed;
}

module.exports = { CharsAllowed, ValidateChars };
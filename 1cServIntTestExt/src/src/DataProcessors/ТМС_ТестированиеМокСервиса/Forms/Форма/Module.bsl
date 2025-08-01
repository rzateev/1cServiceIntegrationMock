
#Область ОбработчикиСобытийФормы

&НаСервере
Процедура ПриСозданииНаСервере(Отказ, СтандартнаяОбработка)
	
	СервисИнтеграции = Метаданные.СервисыИнтеграции.ТМС_mockService;
	
	ЭтотОбъект.Сервис = СервисИнтеграции.Имя;
	
	НаправлениеОтправка = Метаданные.СвойстваОбъектов.НаправлениеСообщенияКаналаСервисаИнтеграции.Отправка;
	
	Для Каждого КаналСервиса Из СервисИнтеграции.КаналыСервисаИнтеграции Цикл
		
		Если КаналСервиса.НаправлениеСообщения = НаправлениеОтправка Тогда
			Элементы.Канал.СписокВыбора.Добавить(КаналСервиса.Имя, КаналСервиса.Имя);
		КонецЕсли;
		
	КонецЦикла;
	
	Если Элементы.Канал.СписокВыбора.Количество() > 0 Тогда 
		ЭтотОбъект.Канал = Элементы.Канал.СписокВыбора[0];
	КонецЕсли;
	
КонецПроцедуры

#КонецОбласти

#Область ОбработчикиКомандФормы

&НаКлиенте
Процедура ОтправитьСообщения(Команда)
	
	ОтправитьСообщенияНаСервере();
	
КонецПроцедуры

&НаКлиенте
Процедура ВыполнитьОбработку(Команда) 
	
	ОтключитьОбработчикОжидания("ПроверитьПолучениеВсехСообщений");
	
	ВыполнитьОбработкуНаСервере();
	
	ПодключитьОбработчикОжидания("ПроверитьПолучениеВсехСообщений", 1);
	
КонецПроцедуры

&НаКлиенте
Процедура ОстановитьОбработку(Команда)
	
	ОстановитьОбработкуНаСервере();
	
	ЭтотОбъект.ДатаНачалаОтправки = Неопределено;
	ЭтотОбъект.ИдентификаторГруппы = Неопределено;
	
	ОтключитьОбработчикОжидания("ПроверитьПолучениеВсехСообщений");
	
КонецПроцедуры

#КонецОбласти

#Область СлужебныеПроцедурыИФункции

&НаСервере
Процедура ОтправитьСообщенияНаСервере()
	
	Если Объект.КоличествоСообщений <= 0 Тогда
		ВызватьИсключение "Количество сообщений должно быть больше 0";
	КонецЕсли;
	
	МассивПолучателей = Новый Массив;
	
	КоличествоОтправленных = 0;
	ЭтотОбъект.ИдентификаторГруппы = XMLСтрока(Новый УникальныйИдентификатор);
	
	Для Счетчик = 1 По Объект.КоличествоСообщений Цикл
		Попытка
			СлучайноеТело = "Тело сообщения: " + XMLСтрока(Новый УникальныйИдентификатор);
			
			ОтправитьСообщение(СлучайноеТело, "Тестовое сообщение №" + Счетчик);
			
			КоличествоОтправленных = КоличествоОтправленных + 1;
			
		Исключение
			ИнформацияОбОшибке = ИнформацияОбОшибке();
			
			ЗаписьЖурналаРегистрации("ОтправкаСообщений", УровеньЖурналаРегистрации.Ошибка, , ,
			"Ошибка при отправке сообщения №" + Счетчик + ": " + ОбработкаОшибок.ПодробноеПредставлениеОшибки(ИнформацияОбОшибке)
			);
		КонецПопытки;
	КонецЦикла;
	
	Сообщить("Сохранено в очереди IntegChannelOutQueue сообщений: " + КоличествоОтправленных + " из " + Объект.КоличествоСообщений);
	
КонецПроцедуры

&НаСервере
Процедура ОтправитьСообщение(ТекстСообщения, Описание = "")
	
	Сообщение = СервисыИнтеграции[Сервис].СоздатьСообщение();
	Сообщение.ИдентификаторСообщенияЗапроса = Новый УникальныйИдентификатор();
	
	Тело = Сообщение.ПолучитьТелоКакПоток();
	Буфер = ПолучитьБуферДвоичныхДанныхИзСтроки(ТекстСообщения);
	Тело.Записать(Буфер, 0, Буфер.Размер);
	Тело.Закрыть();
	
	Сообщение.Параметры.Вставить("РазмерСообщения", Буфер.Размер);
	Сообщение.Параметры.Вставить("ДатаОтправки", Формат(ТекущаяДатаСеанса(), "ДФ=dd.MM.yyyy HH:mm:ss"));
	Сообщение.Параметры.Вставить("Описание", Описание);
	Сообщение.Параметры.Вставить("ТипСообщения", "Тестовое");
	Сообщение.Параметры.Вставить("ИдентификаторГруппы", ЭтотОбъект.ИдентификаторГруппы);
	
	СервисыИнтеграции[Сервис][Канал].ОтправитьСообщение(Сообщение);
	
КонецПроцедуры

&НаСервере
Процедура ВыполнитьОбработкуНаСервере()
	
	ЭтотОбъект.ДатаНачалаОтправки = ТекущаяУниверсальнаяДатаВМиллисекундах();
	СервисыИнтеграции.ВыполнитьОбработку();
	
КонецПроцедуры

&НаКлиенте
Процедура ПроверитьПолучениеВсехСообщений()
	
	ОтключитьОбработчик = ПроверитьПолучениеВсехСообщенийНаСервере();
	
	Если ОтключитьОбработчик Тогда
		ОтключитьОбработчикОжидания("ПроверитьПолучениеВсехСообщений");
	КонецЕсли;
	
КонецПроцедуры

&НаСервере
Функция ПроверитьПолучениеВсехСообщенийНаСервере()
	
	Если Не ЗначениеЗаполнено(ЭтотОбъект.ИдентификаторГруппы) Тогда
		Возврат Истина;
	КонецЕсли;
	
	Запрос = Новый Запрос;
	Запрос.Текст =
	"ВЫБРАТЬ
	|	ТМС_ВходящиеСообщения.УниверсальнаяДатаВМиллисекундах КАК УниверсальнаяДатаВМиллисекундах
	|ИЗ
	|	РегистрСведений.ТМС_ВходящиеСообщения КАК ТМС_ВходящиеСообщения
	|ГДЕ
	|	ТМС_ВходящиеСообщения.ИдентификаторГруппы = &ИдентификаторГруппы
	|
	|УПОРЯДОЧИТЬ ПО
	|	УниверсальнаяДатаВМиллисекундах УБЫВ";
	Запрос.УстановитьПараметр("ИдентификаторГруппы", ЭтотОбъект.ИдентификаторГруппы);
	
	РезультатЗапроса = Запрос.Выполнить();
	Выборка = РезультатЗапроса.Выбрать();
	
	ПолученоСообщений = Выборка.Количество();
	
	Если ПолученоСообщений >= Объект.КоличествоСообщений Тогда
		
		Выборка.Следующий();
		
		ТекстСообщения = СтрШаблон("Начало отправки: %1. Получено последнее сообщение: %2. Разница (мс): %3",
			ЭтотОбъект.ДатаНачалаОтправки, Выборка.УниверсальнаяДатаВМиллисекундах,
			Выборка.УниверсальнаяДатаВМиллисекундах - ЭтотОбъект.ДатаНачалаОтправки);
		
		Сообщить(ТекстСообщения);
		
		Возврат Истина;
	КонецЕсли;
	
	Возврат Ложь;
КонецФункции

&НаСервере
Процедура ОстановитьОбработкуНаСервере()
	
	СервисыИнтеграции.ОстановитьОбработку();
	
КонецПроцедуры

#КонецОбласти
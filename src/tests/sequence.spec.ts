import 'mocha';
import { assert, expect } from 'chai';
import { newDb } from '../db';
import { IMemoryDb } from '../interfaces';

describe('Sequences', () => {

    let db: IMemoryDb;
    let many: (str: string) => any[];
    let none: (str: string) => void;
    let one: (str: string) => any;
    function all(table = 'data') {
        return many(`select * from ${table}`);
    }
    beforeEach(() => {
        db = newDb();
        many = db.public.many.bind(db.public);
        none = db.public.none.bind(db.public);
        one = db.public.one.bind(db.public);
    });


    it('can query next value non qualified default', () => {
        const res = many(`create sequence test;
                    select nextval('test')`);
        expect(res).to.deep.equal([{
            nextval: 1
        }])
    });

    it('can query next value non qualified inc', () => {
        const res = many(`create sequence test increment 5;
                            select nextval('test');`);
        expect(res).to.deep.equal([{
            nextval: 1
        }])
    });

    it('can query next value non qualified start', () => {
        const res = many(`create sequence test start 5 increment 2;
                            select nextval('test');`);
        expect(res).to.deep.equal([{
            nextval: 5
        }])
    });


    it('handles multiple increments', () => {
        let res = many(`create sequence test start 5 increment 2;
                        select nextval('test');
                        select nextval('test');`);
        expect(res).to.deep.equal([{
            nextval: 7
        }]);
        res = many(`select nextval('test');`);
        expect(res).to.deep.equal([{
            nextval: 9
        }])
    });


    it('can query next value qualified', () => {
        const res = many(`create sequence test;
                    select nextval('public."test"')`);
        expect(res).to.deep.equal([{
            nextval: 1
        }])
    });


    it('can query set value', () => {
        const res = many(`create sequence test;
                    select setval('test', 41);
                    select nextval('test');`);
        expect(res).to.deep.equal([{
            nextval: 42
        }])
    });

    it('can query set value when increase is true', () => {
        const res = many(`create sequence test;
                    select setval('test', 41, true);
                    select nextval('test');`);
        expect(res).to.deep.equal([{
            nextval: 42
        }])
    });

    it('can query set value when increase is false', () => {
        const res = many(`create sequence test;
                    select setval('test', 41, false);
                    select nextval('test');`);
        expect(res).to.deep.equal([{
            nextval: 41
        }])
    });

    it('can query current value', () => {
        const res = many(`create sequence test;
                    select setval('test', 42);
                    select CURRval('test');`);
        expect(res).to.deep.equal([{
            currval: 42
        }])
    });

    it('can query current value when increase is true', () => {
        const res = many(`create sequence test;
                    select setval('test', 42, true);
                    select CURRval('test');`);
        expect(res).to.deep.equal([{
            currval: 42
        }])
    });

    it('can query current value when increase is false', () => {
        const res = many(`create sequence test;
                    select setval('test', 42, false);
                    select CURRval('test');`);
        expect(res).to.deep.equal([{
            currval: 42
        }])
    });

    it('fails to get currval without initialization', () => {
        many(`create sequence test start 5 increment 2;`);

        assert.throws(() => none(`select currval('test');`), /currval of sequence "test" is not yet defined in this session/);
    });



    it('can define custom sequences', () => {
        none(`CREATE SEQUENCE if not exists public.test START WITH 40 INCREMENT BY 2 NO MINVALUE NO MAXVALUE CACHE 1 as bigint cycle`);

        const res = many(`select nextval('test');`);
        expect(res).to.deep.equal([{
            nextval: 40
        }])
    });


    it('cannot reach its maximum', () => {
        expect(many(`create sequence test maxvalue 3;
                select nextval('test');
                select nextval('test');
                select nextval('test');`))
            .to.deep.equal([{ nextval: 3 }]);
        assert.throws(() => none(`select nextval('test');`), /reached maximum value of sequence "test"/)
    })

    it('can create an identity sequence', () => {
        expect(many(`CREATE TABLE color (
                        color_id INT GENERATED BY DEFAULT AS IDENTITY
                        (START WITH 10 INCREMENT BY 10),
                        name text
                    );

                    insert into color(name) values ('red'), ('green'), ('blue');
                    select * from color;`)).to.deep.equal([
            { name: 'red', color_id: 10, },
            { name: 'green', color_id: 20, },
            { name: 'blue', color_id: 30, },
        ])
    })


    it('can restart sequence with 0', () => {

        none(`create sequence test minvalue -1;`);
        // restart sequence
        none(`ALTER SEQUENCE test RESTART WITH 0;`);

        // checks on currval & nextval
        assert.throws(() => none(`select currval('test');`), /currval of sequence "test" is not yet defined in this session/);
        expect(one(`select nextval('test');`))
            .to.deep.equal({ nextval: 0 });
        expect(one(`select currval('test');`))
            .to.deep.equal({ currval: 0 });

    });


    it('cannot restart sequence with too low value', () => {

        none(`create sequence test minvalue 5;`);
        // restart sequence
        assert.throws(() => none(`ALTER SEQUENCE test RESTART WITH 4;`), /RESTART value \(4\) cannot be less than MINVALUE \(5\)/);

        none(`ALTER SEQUENCE test RESTART WITH 5;`);

        expect(one(`select nextval('test');`))
            .to.deep.equal({ nextval: 5 });

    });



    it('can restart sequence after usage', () => {
        expect(one(`create sequence test;
                    select setval('test', 41);`))
            .to.deep.equal({ setval: 41 });

        // checks on currval & nextval
        expect(one(`select currval('test');`))
            .to.deep.equal({ currval: 41 });
        expect(one(`select nextval('test');`))
            .to.deep.equal({ nextval: 42 });
        expect(one(`select currval('test');`))
            .to.deep.equal({ currval: 42 });

        // restart sequence
        none(`ALTER SEQUENCE test RESTART WITH 1;`);

        // checks on currval & nextval
        expect(one(`select currval('test');`))
            .to.deep.equal({ currval: 42 }, 'Current value should not have moved after reset');
        expect(one(`select nextval('test');`))
            .to.deep.equal({ nextval: 1 });
        expect(one(`select currval('test');`))
            .to.deep.equal({ currval: 1 });
    });

    it('can restart sequence when not used', () => {
        none(`create sequence test`);
        // restart sequence
        none(`ALTER SEQUENCE test RESTART WITH 5;`);

        // checks on currval & nextval
        assert.throws(() => none(`select currval('test');`), /currval of sequence "test" is not yet defined in this session/);
        expect(one(`select nextval('test');`))
            .to.deep.equal({ nextval: 5 });
        expect(one(`select currval('test');`))
            .to.deep.equal({ currval: 5 });


    })
});
